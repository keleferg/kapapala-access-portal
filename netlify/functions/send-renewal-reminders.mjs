const HAWAII_TIME_ZONE = "Pacific/Honolulu";
const RENEWAL_NOTICE_DAYS = 30;
const MAX_ACCOUNTS_PER_RUN = 100;

function getHawaiiDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year =
    parts.find((part) => part.type === "year")?.value || "";

  const month =
    parts.find((part) => part.type === "month")?.value || "";

  const day =
    parts.find((part) => part.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(value, days) {
  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

async function readJson(response) {
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

export default async function handler() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY."
    );
  }

  const currentHawaiiDate =
    getHawaiiDateString();

  const targetExpirationDate =
    addDaysToDateString(
      currentHawaiiDate,
      RENEWAL_NOTICE_DAYS
    );

  /*
   * Query active accounts expiring exactly 30 Hawaiʻi
   * calendar days from today.
   *
   * The OR condition permits accounts that:
   * 1. have never received a reminder, or
   * 2. received one during a previous renewal cycle.
   */
  const query = new URLSearchParams({
    select:
      "id,access_id,applicant_email,expires_at,renewal_notice_expiration_date",
    status: "eq.active",
    expires_at: `eq.${targetExpirationDate}`,
    order: "access_id.asc",
    limit: String(MAX_ACCOUNTS_PER_RUN),
    or:
      `(renewal_notice_expiration_date.is.null,renewal_notice_expiration_date.neq.${targetExpirationDate})`,
  });

  const accountResponse = await fetch(
    `${supabaseUrl}/rest/v1/access_accounts?${query.toString()}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    }
  );

  const accountResult =
    await readJson(accountResponse);

  if (!accountResponse.ok) {
    throw new Error(
      `Unable to retrieve renewal accounts: ` +
        JSON.stringify(accountResult)
    );
  }

  const accounts =
    Array.isArray(accountResult)
      ? accountResult
      : [];

  const results = [];

  /*
   * Send sequentially to reduce rate-limit pressure and
   * make each result easy to audit in the Netlify log.
   */
  for (const account of accounts) {
    try {
      const emailResponse = await fetch(
        `${supabaseUrl}/functions/v1/send-account-renewal-email`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization:
              `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "reminder",
            access_account_id: account.id,
          }),
        }
      );

      const emailResult =
        await readJson(emailResponse);

      if (
        !emailResponse.ok ||
        emailResult?.success !== true
      ) {
        results.push({
          access_account_id: account.id,
          access_id: account.access_id,
          success: false,
          error:
            emailResult?.error ||
            `Email function returned ${emailResponse.status}.`,
          details: emailResult,
        });

        continue;
      }

      results.push({
        access_account_id: account.id,
        access_id: account.access_id,
        success: true,
        skipped: emailResult?.skipped === true,
        reason: emailResult?.reason || null,
        to: emailResult?.to || null,
        sent_at: emailResult?.sent_at || null,
      });
    } catch (error) {
      results.push({
        access_account_id: account.id,
        access_id: account.access_id,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const sentCount = results.filter(
    (result) =>
      result.success === true &&
      result.skipped !== true
  ).length;

  const skippedCount = results.filter(
    (result) =>
      result.success === true &&
      result.skipped === true
  ).length;

  const failedCount = results.filter(
    (result) => result.success === false
  ).length;

  const summary = {
    success: failedCount === 0,
    current_hawaii_date: currentHawaiiDate,
    target_expiration_date:
      targetExpirationDate,
    matching_accounts: accounts.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    results,
  };

  console.log(
    "Kapāpala account renewal reminder summary:",
    JSON.stringify(summary, null, 2)
  );

  /*
   * Scheduled functions do not use their response body,
   * but returning a Response is useful during local testing.
   */
  return new Response(
    JSON.stringify(summary),
    {
      status: failedCount === 0 ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/*
 * Netlify schedules use UTC.
 * 18:00 UTC = 08:00 Pacific/Honolulu.
 */
export const config = {
  schedule: "0 18 * * *",
};
