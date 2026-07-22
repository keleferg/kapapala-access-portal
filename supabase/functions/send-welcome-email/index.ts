import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const IOS_APP_URL =
  "https://apps.apple.com/us/app/kapapala-forest-reserve-access/id6786978124";

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
  expires_at: string | null;
  welcome_email_sent_at: string | null;
};

const PORTAL_BASE_URL =
  "https://kapapalaforestreserveaccesssystem.netlify.app";

const LOGIN_URL = `${PORTAL_BASE_URL}/login`;
const PASSWORD_SETUP_URL = `${PORTAL_BASE_URL}/set-password`;
const ACCESS_RULES_URL =
  `${PORTAL_BASE_URL}/information/forest-reserve-access`;
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
        expires_at,
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
        reason: "Approval email already sent.",
        welcome_email_sent_at: account.welcome_email_sent_at,
      });
    }

    const recipientEmail = account.applicant_email?.trim();

    if (!recipientEmail) {
      await supabase
        .from("access_accounts")
        .update({
          welcome_email_last_error:
            "Access account has no applicant_email.",
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

    const expirationDate = formatExpirationDate(account.expires_at);

    const subject =
      "Your Kapāpala Forest Reserve Access Account Has Been Approved";

    const html = buildApprovalEmailHtml({
      firstName,
      accessId,
      email: recipientEmail,
      expirationDate,
    });

    const text = buildApprovalEmailText({
      firstName,
      accessId,
      email: recipientEmail,
      expirationDate,
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
        text,
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

function formatExpirationDate(value: string | null): string {
  if (!value) {
    return "Two years from the approval date";
  }

  const datePart = value.slice(0, 10);
  const parts = datePart.split("-").map(Number);

  if (
    parts.length !== 3 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1]) ||
    !Number.isFinite(parts[2])
  ) {
    return value;
  }

  const [year, month, day] = parts;

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function buildApprovalEmailHtml({
  firstName,
  accessId,
  email,
  expirationDate,
}: {
  firstName: string;
  accessId: string;
  email: string;
  expirationDate: string;
}): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kapāpala Access Account Approved</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f0e9;">
    <div
      style="
        display:none;
        max-height:0;
        overflow:hidden;
        opacity:0;
        color:transparent;
      "
    >
      Your Kapāpala Forest Reserve Access Account has been approved.
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
                <div
                  style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:13px;
                    font-weight:700;
                    letter-spacing:1.6px;
                    text-transform:uppercase;
                    color:#d7c59a;
                  "
                >
                  Kapāpala Forest Reserve Access System
                </div>

                <h1
                  style="
                    margin:10px 0 0;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:32px;
                    line-height:1.2;
                    color:#ffffff;
                  "
                >
                  Your Account Has Been Approved
                </h1>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:34px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:16px;
                  line-height:1.65;
                  color:#26332b;
                "
              >
                <p style="margin:0 0 18px;">
                  Aloha ${escapeHtml(firstName)},
                </p>

                <p style="margin:0 0 22px;">
                  Your Kapāpala Forest Reserve Access Account has been
                  reviewed, approved, and activated. You may now sign in and
                  submit access requests, subject to current access rules,
                  gate conditions, and approval requirements.
                </p>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin:0 0 26px;
                    background:#f6f3e9;
                    border:1px solid #ded5bd;
                    border-left:5px solid #b88a34;
                    border-radius:10px;
                  "
                >
                  <tr>
                    <td style="padding:22px;">
                      <div
                        style="
                          margin-bottom:5px;
                          font-size:12px;
                          font-weight:700;
                          letter-spacing:1.2px;
                          text-transform:uppercase;
                          color:#657069;
                        "
                      >
                        Your Access ID
                      </div>

                      <div
                        style="
                          font-family:Georgia,'Times New Roman',serif;
                          font-size:34px;
                          font-weight:700;
                          letter-spacing:4px;
                          color:#23452f;
                        "
                      >
                        ${escapeHtml(accessId)}
                      </div>
                    </td>
                  </tr>
                </table>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin:0 0 28px;
                    border-collapse:collapse;
                    border-top:1px solid #e5e2d9;
                  "
                >
                  <tr>
                    <td
                      style="
                        width:38%;
                        padding:13px 0;
                        border-bottom:1px solid #e5e2d9;
                        color:#657069;
                        font-size:14px;
                      "
                    >
                      Sign-in email
                    </td>

                    <td
                      style="
                        padding:13px 0;
                        border-bottom:1px solid #e5e2d9;
                        font-weight:700;
                        color:#26332b;
                      "
                    >
                      ${escapeHtml(email)}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:38%;
                        padding:13px 0;
                        border-bottom:1px solid #e5e2d9;
                        color:#657069;
                        font-size:14px;
                      "
                    >
                      Account expiration
                    </td>

                    <td
                      style="
                        padding:13px 0;
                        border-bottom:1px solid #e5e2d9;
                        font-weight:700;
                        color:#26332b;
                      "
                    >
                      ${escapeHtml(expirationDate)}
                    </td>
                  </tr>
                </table>

                <h2
                  style="
                    margin:0 0 10px;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:22px;
                    color:#23452f;
                  "
                >
                  Set up your password
                </h2>

                <p style="margin:0 0 22px;">
                  First-time users should select
                  <strong>Set Up Password</strong>. On the password setup page,
                  enter the same email address shown above and follow the
                  secure instructions sent to your inbox. If you already
                  created a password, select <strong>Sign In</strong>.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin:0 0 14px;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#23452f"
                      style="border-radius:8px;"
                    >
                      <a
                        href="${PASSWORD_SETUP_URL}"
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
                        Set Up Password
                      </a>
                    </td>

                    <td style="width:12px;"></td>

                    <td
                      align="center"
                      style="
                        border:1px solid #23452f;
                        border-radius:8px;
                      "
                    >
                      <a
                        href="${LOGIN_URL}"
                        style="
                          display:inline-block;
                          padding:13px 24px;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:15px;
                          font-weight:700;
                          color:#23452f;
                          text-decoration:none;
                        "
                      >
                        Sign In
                      </a>
                    </td>
                  </tr>
                </table>

                <div
                  style="
                    margin:22px 0 26px;
                    padding:20px;
                    background:#f6f3e9;
                    border:1px solid #ded5bd;
                    border-radius:10px;
                  "
                >
                  <h2
                    style="
                      margin:0 0 8px;
                      font-family:Georgia,'Times New Roman',serif;
                      font-size:21px;
                      color:#23452f;
                    "
                  >
                    Download the iOS App
                  </h2>

                  <p style="margin:0 0 16px;">
                    Use the Kapapala Forest Reserve Access app on your iPhone
                    to submit requests, view gate conditions, and access
                    approved gate combinations during authorized hours.
                  </p>

                  <table
                    role="presentation"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="margin:0;"
                  >
                    <tr>
                      <td
                        align="center"
                        bgcolor="#23452f"
                        style="border-radius:8px;"
                      >
                        <a
                          href="${IOS_APP_URL}"
                          target="_blank"
                          rel="noopener noreferrer"
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
                          Download on the App Store
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>

                <p
                  style="
                    margin:18px 0 26px;
                    font-size:13px;
                    line-height:1.55;
                    color:#657069;
                  "
                >
                  For security, never share your password. Keep your Access ID
                  available when communicating with Kapāpala Ranch Operations.
                </p>

                <div
                  style="
                    padding:20px;
                    background:#f3f6f3;
                    border-radius:10px;
                  "
                >
                  <strong style="color:#23452f;">
                    Review access rules before requesting entry
                  </strong>

                  <p style="margin:8px 0 14px;">
                    Gate conditions, access hours, permit requirements, and
                    other rules may change. Review the current information
                    before every visit.
                  </p>

                  <a
                    href="${ACCESS_RULES_URL}"
                    style="
                      color:#23452f;
                      font-weight:700;
                      text-decoration:underline;
                    "
                  >
                    View Forest Reserve Access Information
                  </a>
                </div>

                <p style="margin:28px 0 0;">
                  Mahalo for helping protect Kapāpala and support safe,
                  responsible access to the Forest Reserve.
                </p>

                <p style="margin:18px 0 0;">
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
                  style="color:#23452f; text-decoration:underline;"
                >
                  ${PORTAL_BASE_URL}
                </a>

                <br /><br />

                This message was sent because an access account associated
                with ${escapeHtml(email)} was approved.
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

function buildApprovalEmailText({
  firstName,
  accessId,
  email,
  expirationDate,
}: {
  firstName: string;
  accessId: string;
  email: string;
  expirationDate: string;
}): string {
  return `Aloha ${firstName},

YOUR KAPĀPALA FOREST RESERVE ACCESS ACCOUNT HAS BEEN APPROVED

Your account has been reviewed, approved, and activated. You may now sign in and submit access requests, subject to current access rules, gate conditions, and approval requirements.

Access ID: ${accessId}
Sign-in email: ${email}
Account expiration: ${expirationDate}

SET UP YOUR PASSWORD

First-time users should open the password setup page below, enter the same email address shown above, and follow the secure instructions sent to their inbox:

${PASSWORD_SETUP_URL}

If you already created a password, sign in here:

${LOGIN_URL}

Review current access information and rules before every visit:

${ACCESS_RULES_URL}

Download the Kapāpala Forest Reserve Access iOS App:
${IOS_APP_URL}

Kapāpala Forest Reserve Access Portal:

${PORTAL_BASE_URL}

Never share your password. Keep your Access ID available when communicating with Kapāpala Ranch Operations.

Mahalo for helping protect Kapāpala and support safe, responsible access to the Forest Reserve.

Mahalo,
Kapāpala Ranch Operations`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
