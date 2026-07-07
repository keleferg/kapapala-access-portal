import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RequestBody = {
  access_account_id?: string;
};

type AccessAccountRow = {
  id: string;
  access_id: string | null;
  status: string | null;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
  applicant_email: string | null;
  welcome_email_sent_at: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("WELCOME_EMAIL_FROM");

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable.");
    }

    if (!serviceRoleKey) {
      throw new Error("Missing SERVICE_ROLE_KEY secret.");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY secret.");
    }

    if (!fromEmail) {
      throw new Error("Missing WELCOME_EMAIL_FROM secret.");
    }

    let body: RequestBody;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const accessAccountId = body.access_account_id?.trim();

    if (!accessAccountId) {
      return jsonResponse(
        {
          success: false,
          error: "Missing access_account_id.",
        },
        400
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: account, error: accountError } = await supabase
      .from("access_accounts")
      .select(
        `
        id,
        access_id,
        status,
        applicant_first_name,
        applicant_last_name,
        applicant_email,
        welcome_email_sent_at
      `
      )
      .eq("id", accessAccountId)
      .single<AccessAccountRow>();

    if (accountError || !account) {
      throw new Error(accountError?.message || "Access account not found.");
    }

    const status = String(account.status || "").toLowerCase();

    if (status !== "active") {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Access account is not active.",
        status: account.status,
      });
    }

    if (account.welcome_email_sent_at) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Welcome email already sent.",
        welcome_email_sent_at: account.welcome_email_sent_at,
      });
    }

    const recipientEmail = account.applicant_email?.trim();

    if (!recipientEmail) {
      await supabase
        .from("access_accounts")
        .update({
          welcome_email_last_error: "Access account has no applicant_email.",
        })
        .eq("id", accessAccountId);

      return jsonResponse(
        {
          success: false,
          error: "Access account has no applicant_email.",
        },
        400
      );
    }

    const firstName =
      account.applicant_first_name?.trim() || "Kapāpala Access User";

    const accessId = account.access_id?.trim() || "Not assigned";

    const subject = "Welcome to Kapāpala Forest Reserve Access";

    const html = buildWelcomeEmailHtml({
      firstName,
      accessId,
      email: recipientEmail,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html,
      }),
    });

    const resendResult = await safeReadJson(resendResponse);

    if (!resendResponse.ok) {
      const errorMessage = JSON.stringify(resendResult);

      await supabase
        .from("access_accounts")
        .update({
          welcome_email_last_error: errorMessage,
        })
        .eq("id", accessAccountId);

      return jsonResponse(
        {
          success: false,
          error: "Resend email failed.",
          details: resendResult,
        },
        500
      );
    }

    const sentAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("access_accounts")
      .update({
        welcome_email_sent_at: sentAt,
        welcome_email_last_error: null,
      })
      .eq("id", accessAccountId);

    if (updateError) {
      return jsonResponse(
        {
          success: false,
          error: `Email sent, but database update failed: ${updateError.message}`,
          resend: resendResult,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      access_account_id: accessAccountId,
      to: recipientEmail,
      welcome_email_sent_at: sentAt,
      resend: resendResult,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {
      status: response.status,
      statusText: response.statusText,
    };
  }
}

function buildWelcomeEmailHtml({
  firstName,
  accessId,
  email,
}: {
  firstName: string;
  accessId: string;
  email: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2933;">
      <p>Aloha ${escapeHtml(firstName)},</p>

      <p>
        Welcome to the Kapāpala Forest Reserve Access system. Your access account is active.
      </p>

      <p>
        <strong>Your Access ID:</strong> ${escapeHtml(accessId)}
      </p>

      <p>
        You can find access information, rules, and safety guidance here:
        <br />
        <a href="https://kapapalaranch.com/forest-reserve-access">
          https://kapapalaranch.com/forest-reserve-access
        </a>
      </p>

      <p>
        Please remember that your account must be revalidated every two years,
        and all access users must follow the rules published on the website.
      </p>

      <p>
        To use the app, sign in with this email address:
        <br />
        <strong>${escapeHtml(email)}</strong>
      </p>

      <p>
        If you have not set your password yet, use the app's forgot password
        or password setup process.
      </p>

      <p>
        Mahalo,<br />
        Kapāpala Ranch
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}