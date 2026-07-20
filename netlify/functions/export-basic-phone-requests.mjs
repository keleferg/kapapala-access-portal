import { createClient } from "@supabase/supabase-js";

const HAWAII_TIME_ZONE = "Pacific/Honolulu";

function getHawaiiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value) {
  return cleanString(value).replace(/[^\d+]/g, "");
}

function parseSharePointItemId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatErrorValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function updateRequestSyncStatus(
  supabase,
  requestId,
  values
) {
  const { error } = await supabase
    .from("daily_access_requests")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    console.error(
      `Unable to update sync status for request ${requestId}:`,
      error.message
    );
  }
}

async function exportRequest({
  supabase,
  webhookUrl,
  request,
  account,
  profile,
  gate,
  hawaiiDate,
}) {
  const exportEventId = `basic-phone-request:${request.id}`;

  const firstName =
    cleanString(account.applicant_first_name) ||
    cleanString(profile?.first_name);

  const lastName =
    cleanString(account.applicant_last_name) ||
    cleanString(profile?.last_name);

  const phone =
    normalizePhone(account.applicant_phone) ||
    normalizePhone(profile?.phone);

  if (!phone) {
    throw new Error("No registered phone number is available.");
  }

  const payload = {
    exportEventId,
    requestId: request.id,
    accessAccountId: account.id,
    accessId: cleanString(account.access_id),
    firstName,
    lastName,
    phone,
    requestDate: request.request_date,
    gate: cleanString(gate?.name),
    purpose: cleanString(request.purpose),
    partySize: Number(request.party_size || 1),
    vehicleSummary: cleanString(request.vehicle_summary),
    emergencyContactPhone:
      cleanString(request.emergency_contact_phone) ||
      cleanString(account.emergency_contact_phone),
    dlnrPermitNumber: cleanString(request.dlnr_permit_number),
    organization:
      cleanString(request.organization) ||
      cleanString(account.organization),
    status: "Approved",
  };

  if (!payload.accessId) {
    throw new Error("The account does not have an Access ID.");
  }

  if (!payload.gate) {
    throw new Error("Unable to determine the requested gate.");
  }

  await updateRequestSyncStatus(supabase, request.id, {
    sharepoint_sync_status: "exporting",
    sharepoint_sync_error: null,
  });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": exportEventId,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  let result = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Power Automate returned non-JSON content: ${responseText.slice(
          0,
          300
        )}`
      );
    }
  }

  if (!response.ok || result.success !== true) {
    const detailedError =
      formatErrorValue(result?.error) ||
      formatErrorValue(result) ||
      responseText ||
      `Power Automate returned HTTP ${response.status}.`;

    throw new Error(
      `Power Automate HTTP ${response.status}: ${detailedError}`
    );
  }

  const sharePointItemId = parseSharePointItemId(
    result.sharePointItemId
  );

  if (!sharePointItemId) {
    throw new Error(
      "Power Automate did not return a valid SharePoint item ID."
    );
  }

  await updateRequestSyncStatus(supabase, request.id, {
    sharepoint_item_id: sharePointItemId,
    sharepoint_last_synced_at: new Date().toISOString(),
    sharepoint_sync_status: "synced",
    sharepoint_sync_error: null,
  });

  console.log(
    `Exported request ${request.id} for ${hawaiiDate} ` +
      `to SharePoint item ${sharePointItemId}.`
  );

  return {
    requestId: request.id,
    sharePointItemId,
    changed: result.changed !== false,
    reason: cleanString(result.reason) || "created",
  };
}

async function runExporter() {
  const webhookUrl =
    process.env.SHAREPOINT_BASIC_PHONE_REQUEST_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error(
      "Missing SHAREPOINT_BASIC_PHONE_REQUEST_WEBHOOK_URL."
    );
  }

  const supabase = createSupabaseAdmin();
  const hawaiiDate = getHawaiiDate();

  console.log(
    `Starting basic-phone SharePoint export for ${hawaiiDate} HST.`
  );

  /*
   * Only retrieve:
   * - today's approved requests in Hawaiʻi
   * - requests not already linked to SharePoint
   * - primary entry requests, not generated linked exit requests
   */
  const { data: requests, error: requestsError } = await supabase
    .from("daily_access_requests")
    .select(`
      id,
      access_account_id,
      request_date,
      gate_id,
      purpose,
      party_size,
      vehicle_summary,
      emergency_contact_phone,
      organization,
      dlnr_permit_number,
      sharepoint_item_id,
      linked_request_id
    `)
    .eq("request_date", hawaiiDate)
    .eq("status", "approved")
    .is("sharepoint_item_id", null)
    .is("linked_request_id", null)
    .order("created_at", { ascending: true });

  if (requestsError) {
    throw new Error(
      `Unable to load approved requests: ${requestsError.message}`
    );
  }

  if (!requests?.length) {
    console.log("No eligible approved requests found.");

    return {
      success: true,
      date: hawaiiDate,
      eligible: 0,
      exported: 0,
      failed: 0,
      results: [],
    };
  }

  const accountIds = [
    ...new Set(
      requests
        .map((request) => request.access_account_id)
        .filter(Boolean)
    ),
  ];

  const gateIds = [
    ...new Set(
      requests.map((request) => request.gate_id).filter(Boolean)
    ),
  ];

  const { data: accounts, error: accountsError } = await supabase
    .from("access_accounts")
    .select(`
      id,
      profile_id,
      access_id,
      device_type,
      applicant_first_name,
      applicant_last_name,
      applicant_phone,
      emergency_contact_phone,
      organization
    `)
    .in("id", accountIds)
    .eq("device_type", "basic_phone");

  if (accountsError) {
    throw new Error(
      `Unable to load basic-phone accounts: ${accountsError.message}`
    );
  }

  const basicPhoneAccountMap = new Map(
    (accounts || []).map((account) => [account.id, account])
  );

  const eligibleRequests = requests.filter((request) =>
    basicPhoneAccountMap.has(request.access_account_id)
  );

  if (!eligibleRequests.length) {
    console.log(
      "Approved requests were found, but none belong to basic-phone accounts."
    );

    return {
      success: true,
      date: hawaiiDate,
      eligible: 0,
      exported: 0,
      failed: 0,
      results: [],
    };
  }

  const profileIds = [
    ...new Set(
      (accounts || [])
        .map((account) => account.profile_id)
        .filter(Boolean)
    ),
  ];

  const [
    { data: profiles, error: profilesError },
    { data: gates, error: gatesError },
  ] = await Promise.all([
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, phone")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),

    gateIds.length
      ? supabase
          .from("gates")
          .select("id, name")
          .in("id", gateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesError) {
    throw new Error(
      `Unable to load account profiles: ${profilesError.message}`
    );
  }

  if (gatesError) {
    throw new Error(
      `Unable to load gates: ${gatesError.message}`
    );
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const gateMap = new Map(
    (gates || []).map((gate) => [gate.id, gate])
  );

  const results = [];

  /*
   * Process sequentially to avoid overwhelming Power Automate and to
   * keep each SharePoint creation easy to trace in the function logs.
   */
  for (const request of eligibleRequests) {
    const account = basicPhoneAccountMap.get(
      request.access_account_id
    );

    try {
      const result = await exportRequest({
        supabase,
        webhookUrl,
        request,
        account,
        profile: profileMap.get(account.profile_id),
        gate: gateMap.get(request.gate_id),
        hawaiiDate,
      });

      results.push({
        success: true,
        ...result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown export error.";

      console.error(
        `Failed to export request ${request.id}:`,
        message
      );

      await updateRequestSyncStatus(supabase, request.id, {
        sharepoint_sync_status: "error",
        sharepoint_sync_error: message.slice(0, 1000),
      });

      results.push({
        success: false,
        requestId: request.id,
        error: message,
      });
    }
  }

  const exported = results.filter(
    (result) => result.success
  ).length;

  const failed = results.length - exported;

  console.log(
    `Basic-phone export complete: ${exported} exported, ` +
      `${failed} failed.`
  );

  return {
    success: failed === 0,
    date: hawaiiDate,
    eligible: eligibleRequests.length,
    exported,
    failed,
    results,
  };
}

export default async () => {
  try {
    const result = await runExporter();

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 207,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown scheduled exporter error.";

    console.error("Basic-phone exporter failed:", message);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

/*
 * Netlify schedules are UTC.
 * 10:00 UTC is 12:00 midnight HST.
 */
export const config = {
  schedule: "0 10 * * *",
};
