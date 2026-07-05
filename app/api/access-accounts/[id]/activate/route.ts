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
  return String(Math.floor(Math.random() * (99998 - 10000 + 1)) + 10000);
}

async function generateUniqueAccessId(supabase: ReturnType<typeof createAdminClient>) {
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

    const accessId = existingAccount.access_id || (await generateUniqueAccessId(supabase));

    const { data: updatedAccount, error: updateError } = await supabase
      .from("access_accounts")
      .update({
        access_id: accessId,
        status: "active",
        reviewed_at: new Date().toISOString(),
        revalidated_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 365 * 2
        ).toISOString(),
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

    const firstName =
      updatedAccount.applicant_first_name ||
      updatedAccount.first_name ||
      "there";

    const email =
      updatedAccount.applicant_email ||
      updatedAccount.email ||
      null;

    if (email) {
      console.log("SEND WELCOME EMAIL", {
        to: email,
        subject: "Kapāpala Forest Reserve Access Account Approved",
        body: `Aloha ${firstName},

Welcome to the Kapāpala Forest Reserve Access System. Your Kapāpala Forest Reserve Access Account has been successfully registered and approved.

Your Access ID is:

${accessId}

Please keep this Access ID for your records. You may need it when submitting daily access requests or when communicating with Kapāpala Ranch regarding your access account.

For more information about Kapāpala Forest Reserve access, including current rules, requirements, and important updates, please visit:

https://kapapalaranch.com/forest-reserve-access

As a reminder, your access account must be revalidated every two years in order to remain active. You are also responsible for reviewing and following all rules, requirements, and conditions of access as published on the Kapāpala Ranch website.

Mahalo for helping us protect Kapāpala and ensure safe, responsible access to the Forest Reserve.

Kapāpala Ranch Operations`,
      });
    }

    return NextResponse.json({
      success: true,
      accessId,
      account: updatedAccount,
      emailPrepared: Boolean(email),
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