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

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    "https://kapapalaranch.com"
  ).replace(/\/$/, "");
}

function randomAccessId() {
  return String(Math.floor(Math.random() * (99998 - 10000 + 1)) + 10000);
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

async function createOrUpdateAuthUser({
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
      "Auth user already exists. Continuing with password setup link generation."
    );
    return null;
  }

  throw createUserError;
}

async function generatePasswordSetupLink({
  supabase,
  email,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  email: string;
}) {
  const siteUrl = getSiteUrl();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${siteUrl}/set-password`,
    },
  });

  if (error) {
    console.warn("Unable to generate password setup link:", error);
    return null;
  }

  return data.properties?.action_link || null;
}

async function sendWelcomeEmail({
  email,
  firstName,
  accessId,
  passwordSetupLink,
}: {
  email: string;
  firstName: string;
  accessId: string;
  passwordSetupLink: string | null;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "Kapāpala Ranch Operations <operations@kapapalaranch.com>";

  const subject = "Kapāpala Forest Reserve Access Account Approved";

  const emailBody = `Aloha ${firstName},

Welcome to the Kapāpala Forest Reserve Access System. Your Kapāpala Forest Reserve Access Account has been successfully registered and approved.

Your Access ID is:

${accessId}

To set your account password and access the Kapāpala Access Portal, please use the secure link below:

${
  passwordSetupLink ||
  "Password setup link could not be generated. Please contact Kapāpala Ranch Operations."
}

This link is time-sensitive. If it expires, please contact Kapāpala Ranch Operations for a new password setup link.

Please keep this Access ID for your records. You may need it when submitting daily access requests or when communicating with Kapāpala Ranch regarding your access account.

For more information about Kapāpala Forest Reserve access, including current rules, requirements, and important updates, please visit:

https://kapapalaranch.com/forest-reserve-access

As a reminder, your access account must be revalidated every two years in order to remain active. You are also responsible for reviewing and following all rules, requirements, and conditions of access as published on the Kapāpala Ranch website.

Mahalo for helping us protect Kapāpala and ensure safe, responsible access to the Forest Reserve.

Kapāpala Ranch Operations`;

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is missing. Welcome email was not sent.");
    console.log("WELCOME EMAIL THAT WOULD HAVE BEEN SENT", {
      to: email,
      from: fromEmail,
      subject,
      body: emailBody,
    });

    return {
      sent: false,
      error: "RESEND_API_KEY is missing.",
      result: null,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject,
      text: emailBody,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Welcome email failed:", errorText);

    return {
      sent: false,
      error: errorText,
      result: null,
    };
  }

  const result = await response.json();

  return {
    sent: true,
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

    let authUserId: string | null = null;
    let passwordSetupLink: string | null = null;
    let emailSent = false;
    let emailError: string | null = null;

    if (email) {
      authUserId = await createOrUpdateAuthUser({
        supabase,
        email,
        firstName,
        lastName,
        accountId,
        accessId,
      });

      passwordSetupLink = await generatePasswordSetupLink({
        supabase,
        email,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    const { data: updatedAccount, error: updateError } = await supabase
      .from("access_accounts")
      .update({
        access_id: accessId,
        status: "active",
        profile_id: existingAccount.profile_id || authUserId,
        reviewed_at: now.toISOString(),
        revalidated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
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

    if (email) {
      if (welcomeEmailAlreadySent) {
        console.log("Welcome email already sent. Skipping duplicate send.", {
          accountId,
          welcomeEmailSentAt: existingAccount.welcome_email_sent_at,
        });

        emailSent = false;
        emailError = "Welcome email was already sent previously.";
      } else {
        const welcomeEmailResult = await sendWelcomeEmail({
          email,
          firstName,
          accessId,
          passwordSetupLink,
        });

        emailSent = welcomeEmailResult.sent;
        emailError = welcomeEmailResult.error;

        const { error: emailTrackingError } = await supabase
          .from("access_accounts")
          .update({
            welcome_email_sent_at: welcomeEmailResult.sent
              ? new Date().toISOString()
              : null,
            welcome_email_last_error: welcomeEmailResult.error,
          })
          .eq("id", accountId);

        if (emailTrackingError) {
          console.warn(
            "Unable to update welcome email tracking fields:",
            emailTrackingError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      accessId,
      account: updatedAccount,
      emailPrepared: Boolean(email),
      emailSent,
      emailError,
      welcomeEmailAlreadySent,
      passwordSetupLink,
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