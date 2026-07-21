import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RequestBody = {
  access_account_id?: string;
  force?: boolean;
};

type AccessAccountRow = {
  id: string;
  profile_id: string | null;
  access_id: string | null;
  status: string | null;
  applicant_first_name: string | null;
  applicant_email: string | null;
  setup_version: number | null;
  setup_intro_email_sent_at: string | null;
};

type ProfileRow = {
  first_name: string | null;
  email: string | null;
};

const PORTAL_BASE_URL =
  "https://kapapalaforestreserveaccesssystem.netlify.app";

const LOGIN_URL = `${PORTAL_BASE_URL}/login`;
const PASSWORD_SETUP_URL = `${PORTAL_BASE_URL}/set-password`;
const COMPLETE_SETUP_URL =
  `${PORTAL_BASE_URL}/complete-account-setup`;
const LOGO_URL = `${PORTAL_BASE_URL}/kapapala-access-logo.png`;

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
    const scribeGuideUrl =
      Deno.env.get("SCRIBE_SETUP_GUIDE_URL")?.trim() || "";

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL.");
    }

    if (!serviceRoleKey) {
      throw new Error("Missing SERVICE_ROLE_KEY.");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY.");
    }

    if (!fromEmail) {
      throw new Error("Missing WELCOME_EMAIL_FROM.");
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

    const accessAccountId =
      body.access_account_id?.trim();

    if (!accessAccountId) {
      return jsonResponse(
        {
          success: false,
          error: "Missing access_account_id.",
        },
        400
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: account, error: accountError } =
      await supabase
        .from("access_accounts")
        .select(`
          id,
          profile_id,
          access_id,
          status,
          applicant_first_name,
          applicant_email,
          setup_version,
          setup_intro_email_sent_at
        `)
        .eq("id", accessAccountId)
        .single<AccessAccountRow>();

    if (accountError || !account) {
      throw new Error(
        accountError?.message ||
        "Access account not found."
      );
    }

    if (
      String(account.status || "").toLowerCase() !== "active"
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Access account is not active.",
        status: account.status,
      });
    }

    if (
      account.setup_intro_email_sent_at &&
      body.force !== true
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Setup introduction email already sent.",
        setup_intro_email_sent_at:
          account.setup_intro_email_sent_at,
      });
    }

    let profile: ProfileRow | null = null;

    if (account.profile_id) {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", account.profile_id)
        .maybeSingle<ProfileRow>();

      profile = data;
    }

    const recipientEmail =
      account.applicant_email?.trim() ||
      profile?.email?.trim() ||
      "";

    if (!recipientEmail) {
      const message =
        "Access account has no email address.";

      await supabase
        .from("access_accounts")
        .update({
          setup_intro_email_last_error: message,
        })
        .eq("id", accessAccountId);

      return jsonResponse(
        {
          success: false,
          error: message,
        },
        400
      );
    }

    const firstName =
      account.applicant_first_name?.trim() ||
      profile?.first_name?.trim() ||
      "Kapāpala Access User";

    const accessId =
      account.access_id?.trim() || "Not assigned";

    const subject =
      "Action Required: Set Up Your New Kapāpala Access Account";

    const html = buildEmailHtml({
      firstName,
      accessId,
      email: recipientEmail,
      scribeGuideUrl,
    });

    const text = buildEmailText({
      firstName,
      accessId,
      email: recipientEmail,
      scribeGuideUrl,
    });

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
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
          text,
        }),
      }
    );

    const resendResult =
      await safeReadJson(resendResponse);

    if (!resendResponse.ok) {
      const message = JSON.stringify(resendResult);

      await supabase
        .from("access_accounts")
        .update({
          setup_intro_email_last_error: message,
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
        setup_intro_email_sent_at: sentAt,
        setup_intro_email_last_error: null,
      })
      .eq("id", accessAccountId);

    if (updateError) {
      return jsonResponse(
        {
          success: false,
          error:
            `Email sent, but database update failed: ` +
            updateError.message,
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
      setup_intro_email_sent_at: sentAt,
      resend: resendResult,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
});

function buildEmailHtml({
  firstName,
  accessId,
  email,
  scribeGuideUrl,
}: {
  firstName: string;
  accessId: string;
  email: string;
  scribeGuideUrl: string;
}): string {
  const guideSection = scribeGuideUrl
    ? `
      <div style="
        margin:26px 0 0;
        padding:20px;
        background:#f3f6f3;
        border-radius:10px;
      ">
        <strong style="color:#23452f;">
          Step-by-step setup guide
        </strong>

        <p style="margin:8px 0 12px;">
          Follow the illustrated guide for help signing in,
          completing setup, and submitting a request.
        </p>

        <a
          href="${escapeHtml(scribeGuideUrl)}"
          style="
            color:#23452f;
            font-weight:700;
            text-decoration:underline;
          "
        >
          Open the Setup Guide
        </a>
      </div>
    `
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <title>Set Up Your Kapāpala Access Account</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f0e9;">
    <div style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    ">
      Complete your account setup before submitting your next
      Kapāpala access request.
    </div>

    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f2f0e9;"
    >
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:100%;
              max-width:640px;
              background:#ffffff;
              border:1px solid #dedbd1;
              border-radius:16px;
              overflow:hidden;
            "
          >
            <tr>
              <td align="center" style="padding:30px 28px 24px;">
                <img
                  src="${LOGO_URL}"
                  alt="Kapāpala Ranch"
                  width="390"
                  style="
                    display:block;
                    width:100%;
                    max-width:390px;
                    height:auto;
                    border:0;
                  "
                />
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding:30px 34px;
                  background:#23452f;
                  color:#ffffff;
                "
              >
                <div style="
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:13px;
                  font-weight:700;
                  letter-spacing:1.6px;
                  text-transform:uppercase;
                  color:#d7c59a;
                ">
                  Kapāpala Forest Reserve Access System
                </div>

                <h1 style="
                  margin:10px 0 0;
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:31px;
                  line-height:1.2;
                  color:#ffffff;
                ">
                  Complete Your Account Setup
                </h1>
              </td>
            </tr>

            <tr>
              <td style="
                padding:34px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:16px;
                line-height:1.65;
                color:#26332b;
              ">
                <p style="margin:0 0 18px;">
                  Aloha ${escapeHtml(firstName)},
                </p>

                <p style="margin:0 0 20px;">
                  Kapāpala Forest Reserve is transitioning to a
                  new online access system. Your existing access
                  account has been transferred, and your Access ID
                  remains unchanged.
                </p>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin:0 0 24px;
                    background:#f6f3e9;
                    border:1px solid #ded5bd;
                    border-left:5px solid #b88a34;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td style="padding:22px;">
                      <div style="
                        margin-bottom:5px;
                        font-size:12px;
                        font-weight:700;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                        color:#657069;
                      ">
                        Your Access ID
                      </div>

                      <div style="
                        font-family:Georgia,'Times New Roman',serif;
                        font-size:34px;
                        font-weight:700;
                        letter-spacing:4px;
                        color:#23452f;
                      ">
                        ${escapeHtml(accessId)}
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px;">
                  Before submitting your next request, you must:
                </p>

                <ul style="margin:0 0 24px; padding-left:24px;">
                  <li>Confirm your contact information.</li>
                  <li>Confirm your emergency contact.</li>
                  <li>Select the device used for gate codes.</li>
                  <li>Confirm your preferred gate.</li>
                  <li>
                    Upload a current government ID when required.
                  </li>
                </ul>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin:0 0 16px;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#23452f"
                      style="border-radius:8px;"
                    >
                      <a
                        href="${LOGIN_URL}"
                        style="
                          display:inline-block;
                          padding:14px 24px;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:15px;
                          font-weight:700;
                          color:#ffffff;
                          text-decoration:none;
                        "
                      >
                        Sign In and Complete Setup
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="
                  margin:0 0 22px;
                  font-size:14px;
                  color:#657069;
                ">
                  Sign-in email:
                  <strong>${escapeHtml(email)}</strong>
                </p>

                <p style="margin:0 0 14px;">
                  First-time users or users who do not remember
                  their password should use the password setup page:
                </p>

                <p style="margin:0 0 24px;">
                  <a
                    href="${PASSWORD_SETUP_URL}"
                    style="
                      color:#23452f;
                      font-weight:700;
                      text-decoration:underline;
                    "
                  >
                    Set Up or Reset Your Password
                  </a>
                </p>

                <div style="
                  padding:20px;
                  background:#fff7e8;
                  border:1px solid #e7cf9c;
                  border-radius:10px;
                ">
                  <strong style="color:#6b4b16;">
                    Basic / Flip Phone Users
                  </strong>

                  <p style="margin:8px 0 0;">
                    You must still submit access requests through
                    the web portal. Approved requests will be sent
                    through the existing text-message system.
                  </p>
                </div>

                ${guideSection}

                <p style="margin:28px 0 0;">
                  Access requests must be submitted by
                  <strong>10:00 PM HST on the day before access</strong>.
                  Entry is limited to one gate per day.
                </p>

                <p style="margin:24px 0 0;">
                  Mahalo,<br />
                  <strong>Kapāpala Ranch Operations</strong>
                </p>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding:22px 28px;
                  background:#ece9df;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:12px;
                  line-height:1.55;
                  color:#657069;
                "
              >
                Kapāpala Forest Reserve Access System<br />

                <a
                  href="${PORTAL_BASE_URL}"
                  style="
                    color:#23452f;
                    text-decoration:underline;
                  "
                >
                  ${PORTAL_BASE_URL}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

function buildEmailText({
  firstName,
  accessId,
  email,
  scribeGuideUrl,
}: {
  firstName: string;
  accessId: string;
  email: string;
  scribeGuideUrl: string;
}): string {
  const guideText = scribeGuideUrl
    ? `

STEP-BY-STEP SETUP GUIDE

${scribeGuideUrl}`
    : "";

  return `Aloha ${firstName},

ACTION REQUIRED: COMPLETE YOUR KAPĀPALA ACCESS ACCOUNT SETUP

Kapāpala Forest Reserve is transitioning to a new online access system. Your existing account has been transferred.

Access ID: ${accessId}
Sign-in email: ${email}

Before submitting your next request, you must confirm your contact and emergency information, select your gate-code device, confirm your preferred gate, and upload a current government ID when required.

Sign in and complete setup:

${LOGIN_URL}

Set up or reset your password:

${PASSWORD_SETUP_URL}

Basic / Flip Phone users must still submit access requests through the web portal. Approved requests will be sent through the existing text-message system.

Access requests must be submitted by 10:00 PM HST on the day before access. Entry is limited to one gate per day.${guideText}

Portal:

${PORTAL_BASE_URL}

Mahalo,
Kapāpala Ranch Operations`;
}

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function safeReadJson(
  response: Response
): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
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
