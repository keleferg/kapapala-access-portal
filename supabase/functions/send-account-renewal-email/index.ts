import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type EmailType =
  | "reminder"
  | "corrections_required"
  | "approved"
  | "denied";

type RequestBody = {
  type?: EmailType;
  access_account_id?: string;
  renewal_request_id?: string;
  force?: boolean;
};

type AccessAccountRow = {
  id: string;
  profile_id: string | null;
  access_id: string | null;
  status: string | null;
  applicant_first_name: string | null;
  applicant_email: string | null;
  expires_at: string | null;
  renewal_notice_sent_at: string | null;
  renewal_notice_expiration_date: string | null;
};

type RenewalRequestRow = {
  id: string;
  access_account_id: string;
  status: string;
  proposed_expiration_date: string | null;
  corrections_required_reason: string | null;
  denial_reason: string | null;
  admin_comments: string | null;
  corrections_email_sent_at: string | null;
  approved_email_sent_at: string | null;
  denied_email_sent_at: string | null;
};

type ProfileRow = {
  first_name: string | null;
  email: string | null;
};

const PORTAL_BASE_URL =
  "https://kapapalaforestreserveaccesssystem.netlify.app";

const LOGIN_URL = `${PORTAL_BASE_URL}/login`;

const RENEWAL_URL =
  `${PORTAL_BASE_URL}/complete-account-setup?mode=renewal`;

const DASHBOARD_URL = `${PORTAL_BASE_URL}/dashboard`;

const LOGO_URL =
  `${PORTAL_BASE_URL}/kapapala-access-logo.png`;

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

    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const resendApiKey =
      Deno.env.get("RESEND_API_KEY");

    const fromEmail =
      Deno.env.get("WELCOME_EMAIL_FROM");

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL.");
    }

    if (!serviceRoleKey) {
      throw new Error(
        "Missing SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY."
      );
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

    const emailType = body.type;

    if (
      emailType !== "reminder" &&
      emailType !== "corrections_required" &&
      emailType !== "approved" &&
      emailType !== "denied"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid renewal email type.",
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

    let renewalRequest: RenewalRequestRow | null = null;
    let accessAccountId =
      body.access_account_id?.trim() || "";

    if (emailType !== "reminder") {
      const renewalRequestId =
        body.renewal_request_id?.trim();

      if (!renewalRequestId) {
        return jsonResponse(
          {
            success: false,
            error: "Missing renewal_request_id.",
          },
          400
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from("access_account_renewal_requests")
        .select(`
          id,
          access_account_id,
          status,
          proposed_expiration_date,
          corrections_required_reason,
          denial_reason,
          admin_comments,
          corrections_email_sent_at,
          approved_email_sent_at,
          denied_email_sent_at
        `)
        .eq("id", renewalRequestId)
        .single<RenewalRequestRow>();

      if (error || !data) {
        throw new Error(
          error?.message || "Renewal request not found."
        );
      }

      renewalRequest = data;
      accessAccountId = data.access_account_id;
    }

    if (!accessAccountId) {
      return jsonResponse(
        {
          success: false,
          error: "Missing access_account_id.",
        },
        400
      );
    }

    const {
      data: account,
      error: accountError,
    } = await supabase
      .from("access_accounts")
      .select(`
        id,
        profile_id,
        access_id,
        status,
        applicant_first_name,
        applicant_email,
        expires_at,
        renewal_notice_sent_at,
        renewal_notice_expiration_date
      `)
      .eq("id", accessAccountId)
      .single<AccessAccountRow>();

    if (accountError || !account) {
      throw new Error(
        accountError?.message ||
        "Access account not found."
      );
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
      throw new Error(
        "Access account has no email address."
      );
    }

    const firstName =
      account.applicant_first_name?.trim() ||
      profile?.first_name?.trim() ||
      "Kapāpala Access User";

    const accessId =
      account.access_id?.trim() || "Not assigned";

    const expirationDate =
      formatDate(account.expires_at);

    if (
      emailType === "reminder" &&
      account.renewal_notice_expiration_date ===
        account.expires_at?.slice(0, 10) &&
      body.force !== true
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason:
          "Renewal reminder already sent for this expiration date.",
      });
    }

    if (
      emailType === "corrections_required" &&
      renewalRequest?.corrections_email_sent_at &&
      body.force !== true
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason:
          "Corrections-required email already sent.",
      });
    }

    if (
      emailType === "approved" &&
      renewalRequest?.approved_email_sent_at &&
      body.force !== true
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Approval email already sent.",
      });
    }

    if (
      emailType === "denied" &&
      renewalRequest?.denied_email_sent_at &&
      body.force !== true
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Denial email already sent.",
      });
    }

    const content = getEmailContent({
      emailType,
      firstName,
      accessId,
      expirationDate,
      newExpirationDate: formatDate(
        renewalRequest?.proposed_expiration_date
      ),
      correctionsReason:
        renewalRequest?.corrections_required_reason || "",
      denialReason:
        renewalRequest?.denial_reason || "",
      adminComments:
        renewalRequest?.admin_comments || "",
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
          subject: content.subject,
          html: content.html,
          text: content.text,
        }),
      }
    );

    const resendResult =
      await safeReadJson(resendResponse);

    if (!resendResponse.ok) {
      const errorMessage =
        JSON.stringify(resendResult);

      if (renewalRequest) {
        await supabase
          .from("access_account_renewal_requests")
          .update({
            email_last_error: errorMessage,
          })
          .eq("id", renewalRequest.id);
      }

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

    if (emailType === "reminder") {
      const {
        error: updateError,
      } = await supabase
        .from("access_accounts")
        .update({
          renewal_notice_sent_at: sentAt,
          renewal_notice_expiration_date:
            account.expires_at?.slice(0, 10) || null,
        })
        .eq("id", accessAccountId);

      if (updateError) {
        throw new Error(
          `Email sent, but reminder tracking failed: ${updateError.message}`
        );
      }
    } else if (renewalRequest) {
      const trackingColumn =
        emailType === "corrections_required"
          ? "corrections_email_sent_at"
          : emailType === "approved"
            ? "approved_email_sent_at"
            : "denied_email_sent_at";

      const {
        error: updateError,
      } = await supabase
        .from("access_account_renewal_requests")
        .update({
          [trackingColumn]: sentAt,
          email_last_error: null,
        })
        .eq("id", renewalRequest.id);

      if (updateError) {
        throw new Error(
          `Email sent, but email tracking failed: ${updateError.message}`
        );
      }
    }

    return jsonResponse({
      success: true,
      type: emailType,
      access_account_id: accessAccountId,
      renewal_request_id:
        renewalRequest?.id || null,
      to: recipientEmail,
      sent_at: sentAt,
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

function getEmailContent({
  emailType,
  firstName,
  accessId,
  expirationDate,
  newExpirationDate,
  correctionsReason,
  denialReason,
  adminComments,
}: {
  emailType: EmailType;
  firstName: string;
  accessId: string;
  expirationDate: string;
  newExpirationDate: string;
  correctionsReason: string;
  denialReason: string;
  adminComments: string;
}) {
  if (emailType === "reminder") {
    const subject =
      "Action Required: Renew Your Kapāpala Access Account";

    const heading =
      "Your access account expires soon";

    const message =
      `Your Kapāpala Forest Reserve Access Account ` +
      `is scheduled to expire on ${expirationDate}. ` +
      `Please review and update your account information, ` +
      `acknowledge all current access rules, and submit your ` +
      `renewal request for administrative approval.`;

    return buildEmail({
      subject,
      heading,
      firstName,
      accessId,
      message,
      buttonLabel: "Renew Your Account",
      buttonUrl: RENEWAL_URL,
      secondaryMessage:
        "Failure to renew may interrupt your ability to submit access requests or retrieve gate combinations.",
    });
  }

  if (emailType === "corrections_required") {
    const subject =
      "Corrections Required for Your Kapāpala Account Renewal";

    const heading =
      "Your renewal needs corrections";

    const message =
      `Kapāpala Ranch Operations reviewed your renewal ` +
      `request and needs additional or corrected information.`;

    return buildEmail({
      subject,
      heading,
      firstName,
      accessId,
      message,
      detailLabel: "Corrections required",
      detailValue:
        correctionsReason ||
        "Please review the information in your renewal request.",
      buttonLabel: "Update Renewal Request",
      buttonUrl: RENEWAL_URL,
      secondaryMessage:
        "Open the renewal wizard, make the requested corrections, acknowledge the rules again, and resubmit.",
    });
  }

  if (emailType === "approved") {
    const subject =
      "Your Kapāpala Access Account Renewal Has Been Approved";

    const heading =
      "Your renewal has been approved";

    const message =
      `Your Kapāpala Forest Reserve Access Account ` +
      `has been renewed. Your existing Access ID remains the same.`;

    return buildEmail({
      subject,
      heading,
      firstName,
      accessId,
      message,
      detailLabel: "New expiration date",
      detailValue: newExpirationDate,
      buttonLabel: "Open Dashboard",
      buttonUrl: DASHBOARD_URL,
      secondaryMessage:
        adminComments ||
        "You may continue using the Kapāpala access system normally.",
    });
  }

  const subject =
    "Kapāpala Access Account Renewal Decision";

  const heading =
    "Your renewal was not approved";

  const message =
    `Kapāpala Ranch Operations has denied your current ` +
    `account renewal request.`;

  return buildEmail({
    subject,
    heading,
    firstName,
    accessId,
    message,
    detailLabel: "Reason",
    detailValue:
      denialReason ||
      "Please contact Kapāpala Ranch Operations for more information.",
    buttonLabel: "Sign In",
    buttonUrl: LOGIN_URL,
    secondaryMessage:
      "Your existing account history has been retained.",
  });
}

function buildEmail({
  subject,
  heading,
  firstName,
  accessId,
  message,
  detailLabel,
  detailValue,
  buttonLabel,
  buttonUrl,
  secondaryMessage,
}: {
  subject: string;
  heading: string;
  firstName: string;
  accessId: string;
  message: string;
  detailLabel?: string;
  detailValue?: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryMessage: string;
}) {
  const detailHtml =
    detailLabel && detailValue
      ? `
        <div style="
          margin:24px 0;
          padding:16px;
          background:#f4f7f2;
          border-left:4px solid #315c3b;
          border-radius:6px;
        ">
          <strong>${escapeHtml(detailLabel)}:</strong>
          <div style="margin-top:6px;">
            ${escapeHtml(detailValue)}
          </div>
        </div>
      `
      : "";

  const detailText =
    detailLabel && detailValue
      ? `\n${detailLabel}: ${detailValue}\n`
      : "";

  const html = `
<!doctype html>
<html>
  <body style="
    margin:0;
    padding:0;
    background:#f3f4f1;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2933;
  ">
    <div style="
      max-width:640px;
      margin:0 auto;
      padding:28px 16px;
    ">
      <div style="
        background:#ffffff;
        border-radius:12px;
        overflow:hidden;
        box-shadow:0 4px 18px rgba(0,0,0,0.08);
      ">
        <div style="
          background:#183f2a;
          padding:24px;
          text-align:center;
        ">
          <img
            src="${LOGO_URL}"
            alt="Kapāpala Forest Reserve Access"
            style="max-width:180px;height:auto;"
          />
        </div>

        <div style="padding:30px;">
          <h1 style="
            margin:0 0 18px;
            font-size:25px;
            color:#183f2a;
          ">
            ${escapeHtml(heading)}
          </h1>

          <p>Aloha ${escapeHtml(firstName)},</p>

          <p style="line-height:1.6;">
            ${escapeHtml(message)}
          </p>

          <p>
            <strong>Access ID:</strong>
            ${escapeHtml(accessId)}
          </p>

          ${detailHtml}

          <div style="text-align:center;margin:30px 0;">
            <a
              href="${buttonUrl}"
              style="
                display:inline-block;
                padding:14px 24px;
                background:#315c3b;
                color:#ffffff;
                text-decoration:none;
                border-radius:7px;
                font-weight:bold;
              "
            >
              ${escapeHtml(buttonLabel)}
            </a>
          </div>

          <p style="
            line-height:1.6;
            color:#52606d;
          ">
            ${escapeHtml(secondaryMessage)}
          </p>

          <p style="margin-top:28px;">
            Mahalo,<br />
            Kapāpala Ranch Operations
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

  const text = `
${heading}

Aloha ${firstName},

${message}

Access ID: ${accessId}
${detailText}
${buttonLabel}: ${buttonUrl}

${secondaryMessage}

Mahalo,
Kapāpala Ranch Operations
`.trim();

  return {
    subject,
    html,
    text,
  };
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "Not available";

  const [year, month, day] =
    value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}/${year}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function safeReadJson(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}
