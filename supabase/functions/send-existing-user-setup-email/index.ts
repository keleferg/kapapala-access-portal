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

const IOS_APP_URL =
  "https://apps.apple.com/us/app/kapapala-forest-reserve-access/id6786978124";

const LOGIN_URL = `${PORTAL_BASE_URL}/login`;
const PASSWORD_SETUP_URL = `${PORTAL_BASE_URL}/set-password`;
const ACTIVATION_REDIRECT_URL =
  `${PORTAL_BASE_URL}/auth/callback?next=/set-password`;
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

    const { data: activationData, error: activationError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: recipientEmail,
        options: {
          redirectTo: ACTIVATION_REDIRECT_URL,
        },
      });

    if (activationError) {
      const message =
        `Unable to generate activation link: ${activationError.message}`;

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
        500
      );
    }

    const activationLink =
      activationData?.properties?.action_link?.trim() || "";

    if (!activationLink) {
      const message =
        "Supabase did not return an activation link.";

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
        500
      );
    }

    const subject =
      "Action Required: Activate Your Kapāpala Access Account";

    const html = buildEmailHtml({
      firstName,
      accessId,
      email: recipientEmail,
      activationLink,
      scribeGuideUrl,
    });

    const text = buildEmailText({
      firstName,
      accessId,
      email: recipientEmail,
      activationLink,
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
  activationLink,
  scribeGuideUrl,
}: {
  firstName: string;
  accessId: string;
  email: string;
  activationLink: string;
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
          Follow the illustrated guide for help activating your
          account and submitting an access request.
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
    <title>Activate Your Kapāpala Access Account</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f0e9;">
    <div style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    ">
      Activate your Kapāpala access account by September 1, 2026.
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
                  alt="Kapāpala Forest Reserve Access"
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
                  Activate Your Access Account
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
                  The new Kapāpala Forest Reserve Access System is
                  now live.
                </p>

                <p style="margin:0 0 20px;">
                  To continue requesting access to Kapāpala Forest
                  Reserve, you must activate your existing account
                  by <strong>September 1, 2026</strong>.
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
                        Your Existing Access ID
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

                <p style="margin:0 0 20px;">
                  Please do not submit a new account application.
                  Use the personalized activation button below to
                  connect to your existing account and complete the
                  required setup.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin:0 0 24px;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#23452f"
                      style="border-radius:8px;"
                    >
                      <a
                        href="${escapeHtml(activationLink)}"
                        style="
                          display:inline-block;
                          padding:15px 26px;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:16px;
                          font-weight:700;
                          color:#ffffff;
                          text-decoration:none;
                        "
                      >
                        Activate Your Existing Account
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="
                  margin:0 0 24px;
                  font-size:14px;
                  color:#657069;
                ">
                  Account email:
                  <strong>${escapeHtml(email)}</strong>
                </p>

                <p style="margin:0 0 10px;">
                  During activation, you will be asked to:
                </p>

                <ul style="margin:0 0 24px; padding-left:24px;">
                  <li>Create or reset your password.</li>
                  <li>Verify your name, email address, and phone number.</li>
                  <li>Confirm your mailing address.</li>
                  <li>Select your preferred gate.</li>
                  <li>Provide emergency contact information.</li>
                  <li>Select the device you will use to receive gate information.</li>
                  <li>Upload a valid government-issued ID if one is not already on file.</li>
                  <li>Review and accept the Kapāpala Forest Reserve access rules.</li>
                </ul>

                <div style="
                  margin:24px 0;
                  padding:20px;
                  background:#f6f3e9;
                  border:1px solid #ded5bd;
                  border-radius:10px;
                ">
                  <h2 style="
                    margin:0 0 12px;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:21px;
                    color:#23452f;
                  ">
                    Submit Access Requests
                  </h2>

                  <p style="margin:0 0 16px;">
                    Once your activation is complete, you may use
                    either of the following apps to submit your
                    access requests.
                  </p>

                  <p style="margin:0 0 10px;">
                    <strong>Kapāpala Web App</strong><br />
                    <a href="${PORTAL_BASE_URL}/" style="color:#23452f; font-weight:700; text-decoration:underline;">
                      Open the Web App
                    </a>
                  </p>

                  <p style="margin:0;">
                    <strong>Kapāpala iOS App</strong><br />
                    <a href="${IOS_APP_URL}" style="color:#23452f; font-weight:700; text-decoration:underline;">
                      Download on the App Store
                    </a>
                  </p>
                </div>

                <div style="
                  margin:24px 0;
                  padding:20px;
                  background:#fff7e8;
                  border:1px solid #e7cf9c;
                  border-radius:10px;
                ">
                  <strong style="color:#6b4b16;">
                    Important Transition Information
                  </strong>

                  <p style="margin:8px 0 0;">
                    The Microsoft Form will remain available through
                    <strong>September 1, 2026</strong>. However, we
                    strongly encourage you to begin using either the
                    iOS App or the Web App now so you can become
                    familiar with the new process.
                  </p>

                  <p style="margin:12px 0 0;">
                    After <strong>September 1, 2026</strong>, the Web
                    App and iOS App will be the only ways to submit
                    access requests.
                  </p>
                </div>

                <p style="margin:0 0 20px;">
                  Both apps allow you to manage your account, save
                  vehicles, submit access requests, review upcoming
                  trips, view gate conditions, and access approved
                  gate information.
                </p>

                <p style="margin:0 0 20px;">
                  Please complete your activation no later than
                  <strong>September 1, 2026</strong>. Accounts that
                  have not completed activation may be unable to
                  submit new access requests through the new system.
                </p>

                ${guideSection}

                <p style="margin:24px 0 0;">
                  This email is intended for the authorized holder
                  of Access ID ${escapeHtml(accessId)}. Do not
                  forward the activation link or share your account
                  credentials.
                </p>

                <p style="margin:24px 0 0;">
                  For assistance, contact:<br />
                  <strong>Kapāpala Forest Reserve Access</strong><br />
                  <a href="mailto:operations@kapapalaranch.com" style="color:#23452f;">
                    operations@kapapalaranch.com
                  </a><br />
                </p>

                <p style="margin:24px 0 0;">
                  Mahalo,<br />
                  <strong>Kapāpala Forest Reserve Access Team</strong>
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
                <a href="${PORTAL_BASE_URL}/" style="color:#23452f; text-decoration:underline;">
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
  activationLink,
  scribeGuideUrl,
}: {
  firstName: string;
  accessId: string;
  email: string;
  activationLink: string;
  scribeGuideUrl: string;
}): string {
  const guideText = scribeGuideUrl
    ? `

STEP-BY-STEP SETUP GUIDE

${scribeGuideUrl}`
    : "";

  return `Aloha ${firstName},

ACTION REQUIRED: ACTIVATE YOUR KAPĀPALA ACCESS ACCOUNT

The new Kapāpala Forest Reserve Access System is now live.

To continue requesting access to Kapāpala Forest Reserve, you must activate your existing account by September 1, 2026.

Your current Access ID will remain the same:

Access ID: ${accessId}

Please do not submit a new account application. Use the personalized activation link below to connect to your existing account and complete the required setup.

ACTIVATE YOUR EXISTING ACCOUNT

${activationLink}

Account email: ${email}

During activation, you will be asked to:

- Create or reset your password
- Verify your name, email address, and phone number
- Confirm your mailing address
- Select your preferred gate
- Provide emergency contact information
- Select the device you will use to receive gate information
- Upload a valid government-issued ID if one is not already on file
- Review and accept the Kapāpala Forest Reserve access rules

Once your activation is complete, you may use either of the following apps to submit your access requests.

Kapāpala Web App:
${PORTAL_BASE_URL}/

Kapāpala iOS App:
${IOS_APP_URL}

The Microsoft Form will remain available through September 1, 2026. However, we strongly encourage you to begin using either the iOS App or the Web App now so you can become familiar with the new process.

After September 1, 2026, the Web App and iOS App will be the only ways to submit access requests.

Both apps allow you to manage your account, save vehicles, submit access requests, review upcoming trips, view gate conditions, and access approved gate information.

Please complete your activation no later than September 1, 2026. Accounts that have not completed activation may be unable to submit new access requests through the new system.${guideText}

This email is intended for the authorized holder of Access ID ${accessId}. Do not forward the activation link or share your account credentials.

For assistance, contact:

Kapāpala Forest Reserve Access
operations@kapapalaranch.com

Mahalo,

Kapāpala Forest Reserve Access Team`;
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
