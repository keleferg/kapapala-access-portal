import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RequestBody = {
  access_account_id?: string;
};

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type AccessAccountRow = {
  id: string;
  access_id: string | null;
  status: string | null;
  profile_id: string | null;
  submission_confirmation_sent_at: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
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
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
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

    const { data, error: accountError } = await supabase
      .from("access_accounts")
      .select(
        `
        id,
        access_id,
        status,
        profile_id,
        submission_confirmation_sent_at,
        profiles!access_accounts_profile_id_fkey (
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("id", accessAccountId)
      .single();

    const account = data as AccessAccountRow | null;

    if (accountError || !account) {
      throw new Error(accountError?.message || "Access account not found.");
    }

    if (account.submission_confirmation_sent_at) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Submission confirmation already sent.",
        submission_confirmation_sent_at:
          account.submission_confirmation_sent_at,
      });
    }

    const profile = Array.isArray(account.profiles)
      ? account.profiles[0]
      : account.profiles;

    const recipientEmail = profile?.email?.trim();

    if (!recipientEmail) {
      await supabase
        .from("access_accounts")
        .update({
          submission_confirmation_last_error:
            "Access account profile has no email.",
        })
        .eq("id", accessAccountId);

      return jsonResponse(
        {
          success: false,
          error: "Access account profile has no email.",
        },
        400
      );
    }

    const firstName =
      profile?.first_name?.trim() || "Kapāpala Access User";

    const accessId = account.access_id?.trim() || "Not assigned";

    const subject = "Kapāpala Access account request received";

    const html = buildSubmissionEmailHtml({
      firstName,
      accessId,
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
          submission_confirmation_last_error: errorMessage,
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
        submission_confirmation_sent_at: sentAt,
        submission_confirmation_last_error: null,
      })
      .eq("id", accessAccountId);

    if (updateError) {
      return jsonResponse(
        {
          success: false,
          error:
            `Email sent, but database update failed: ${updateError.message}`,
          resend: resendResult,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      access_account_id: accessAccountId,
      access_id: accessId,
      to: recipientEmail,
      submission_confirmation_sent_at: sentAt,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSubmissionEmailHtml({
  firstName,
  accessId,
}: {
  firstName: string;
  accessId: string;
}): string {
  const safeFirstName = escapeHtml(firstName);
  const safeAccessId = escapeHtml(accessId);

  return `
    <div
      style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #1f2933;
        max-width: 640px;
        margin: 0 auto;
      "
    >
      <h2 style="color: #23472f;">
        Kapāpala Access Account Request Received
      </h2>

      <p>Aloha ${safeFirstName},</p>

      <p>
        Your Kapāpala Forest Reserve Access account request has been
        successfully submitted.
      </p>

      <div
        style="
          background: #f3f6f2;
          border-left: 4px solid #3f6b48;
          padding: 16px;
          margin: 20px 0;
        "
      >
        <strong>Your Access ID:</strong>
        <span style="font-size: 20px; margin-left: 8px;">
          ${safeAccessId}
        </span>
      </div>

      <p>
        Your account is currently pending review. You will receive another
        email after your account has been approved.
      </p>

      <p>
        Please keep your Access ID for future access requests and account
        assistance.
      </p>

      <p>
        Mahalo,<br>
        Kapāpala Forest Reserve Access
      </p>
    </div>
  `;
}
