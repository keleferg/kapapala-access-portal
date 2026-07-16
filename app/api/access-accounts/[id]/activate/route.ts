import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function randomAccessId() {
  // IDs 99900–99999 are reserved exclusively for testing.
  // randomInt's upper bound is exclusive.
  return String(randomInt(10000, 99900));
}

async function generateUniqueAccessId(
  supabase: ReturnType<typeof createAdminClient>
) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = randomAccessId();

    const { data, error } = await supabase
      .from("access_accounts")
      .select("id")
      .eq("access_id", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique Access ID.");
}

async function findProfileIdByEmail({
  supabase,
  email,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.warn("Unable to look up existing profile by email:", error);
    return null;
  }

  return data?.id ?? null;
}

async function createOrFindAuthUser({
  supabase,
  email,
  firstName,
  lastName,
  accountId,
  accessId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  email: string;
  firstName: string;
  lastName: string;
  accountId: string;
  accessId: string;
}) {
  const existingProfileId = await findProfileIdByEmail({ supabase, email });

  if (existingProfileId) {
    return existingProfileId;
  }

  const temporaryPassword = crypto.randomUUID();

  const { data: createdUserData, error: createUserError } =
    await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        access_account_id: accountId,
        access_id: accessId,
      },
    });

  if (!createUserError) {
    return createdUserData.user?.id ?? null;
  }

  const message = createUserError.message.toLowerCase();

  if (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists")
  ) {
    console.warn(
      "Auth user already exists, but no matching profile row was found."
    );
    return null;
  }

  throw createUserError;
}

async function callWelcomeEmailFunction(accountId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      sent: false,
      skipped: false,
      error:
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      result: null,
    };
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-welcome-email`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_account_id: accountId,
      }),
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    return {
      sent: false,
      skipped: false,
      error:
        result?.error ||
        result?.details?.message ||
        "Welcome email function failed.",
      result,
    };
  }

  return {
    sent: !result.skipped,
    skipped: Boolean(result.skipped),
    error: null,
    result,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = id;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Missing account ID." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: existingAccount, error: loadError } = await supabase
      .from("access_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (loadError || !existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error: loadError?.message || "Access account not found.",
        },
        { status: 404 }
      );
    }

    const accessId =
      existingAccount.access_id || (await generateUniqueAccessId(supabase));

    const firstName =
      existingAccount.applicant_first_name ||
      existingAccount.first_name ||
      "there";

    const lastName =
      existingAccount.applicant_last_name || existingAccount.last_name || "";

    const email =
      existingAccount.applicant_email || existingAccount.email || null;

    const welcomeEmailAlreadySent = Boolean(
      existingAccount.welcome_email_sent_at
    );

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    let authUserId: string | null = existingAccount.profile_id || null;

    if (email && !authUserId) {
      authUserId = await createOrFindAuthUser({
        supabase,
        email,
        firstName,
        lastName,
        accountId,
        accessId,
      });
    }

    const { data: updatedAccount, error: updateError } = await supabase
      .from("access_accounts")
      .update({
        access_id: accessId,
        status: "active",
        profile_id: existingAccount.profile_id || authUserId,
        issued_at: existingAccount.issued_at || now.toISOString(),
        reviewed_at: now.toISOString(),
        revalidated_at: now.toISOString(),
        expires_at: expiresAt.toISOString().slice(0, 10),
        updated_at: now.toISOString(),
      })
      .eq("id", accountId)
      .select("*")
      .single();

    if (updateError || !updatedAccount) {
      return NextResponse.json(
        {
          success: false,
          error: updateError?.message || "Unable to activate account.",
        },
        { status: 500 }
      );
    }

    if (existingAccount.status !== "active") {
      const { error: timelineError } = await supabase
        .from("timeline_events")
        .insert({
          access_account_id: accountId,
          event_type: "access_account_approved",
          event_title: "Access Account Approved",
          event_body: `Access account approved and Access ID ${accessId} issued.`,
        });

      if (timelineError) {
        console.warn("Unable to create approval timeline event:", timelineError);
      }
    }

    if (!email) {
      return NextResponse.json({
        success: true,
        accessId,
        account: updatedAccount,
        emailPrepared: false,
        emailSent: false,
        emailError: "No applicant email address on file.",
        welcomeEmailAlreadySent,
      });
    }

    if (welcomeEmailAlreadySent) {
      return NextResponse.json({
        success: true,
        accessId,
        account: updatedAccount,
        emailPrepared: true,
        emailSent: false,
        emailSkipped: true,
        emailError: "Welcome email was already sent previously.",
        welcomeEmailAlreadySent: true,
      });
    }

    const welcomeEmailResult = await callWelcomeEmailFunction(accountId);

    return NextResponse.json({
      success: true,
      accessId,
      account: updatedAccount,
      emailPrepared: true,
      emailSent: welcomeEmailResult.sent,
      emailSkipped: welcomeEmailResult.skipped,
      emailError: welcomeEmailResult.error,
      welcomeEmailAlreadySent: false,
      emailResult: welcomeEmailResult.result,
    });
  } catch (error) {
    console.error("Account activation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate account.",
      },
      { status: 500 }
    );
  }
}