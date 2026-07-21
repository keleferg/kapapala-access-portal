import { extractText, getDocumentProxy } from "unpdf";

type SupabaseClientLike = any;

type ParsedPermit = {
  id?: string;
  permit_no: string;
  normalized_permit_no: string;
  permittee: string;
  normalized_permittee: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  row_number: number;
  raw_row: Record<string, unknown>;
};

type RequestCandidate = {
  id: string;
  request_date: string;
  exit_date: string | null;
  dlnr_permit_number: string | null;
  summit_permit_number: string | null;
  purpose: string | null;
  access_accounts?: unknown;
};

type MatchChoice = {
  request: RequestCandidate;
  permit: ParsedPermit;
  score: number;
  method: string;
  notes: string;
};

function normalizePermitNumber(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeName(value?: string | null): string {
  let name = (value ?? "").trim();

  if (name.includes(",")) {
    const [last, ...rest] = name.split(",");
    const first = rest.join(" ").trim();
    name = `${first} ${last}`.trim();
  }

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻ’']/g, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeGateName(value?: string | null): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function parseDlnrDate(value: string): string {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid DLNR date: ${value}`);
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

function unwrapRelation<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  if (value && typeof value === "object") {
    return value as T;
  }

  return null;
}

function requestName(request: RequestCandidate): string {
  const account = unwrapRelation<{
    applicant_first_name?: string | null;
    applicant_last_name?: string | null;
    profiles?: unknown;
  }>(request.access_accounts);

  const profile = unwrapRelation<{
    first_name?: string | null;
    last_name?: string | null;
  }>(account?.profiles);

  const first =
    profile?.first_name?.trim() ||
    account?.applicant_first_name?.trim() ||
    "";

  const last =
    profile?.last_name?.trim() ||
    account?.applicant_last_name?.trim() ||
    "";

  return `${first} ${last}`.trim();
}

function parsePermitRows(text: string): ParsedPermit[] {
  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n");

  /*
   * Expected row:
   * 2026-21861 Yarberry, Echo 09-07-2026 11-07-2026 3
   */
  const pattern =
    /(\d{4}-\d{5})\s+(.+?)\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(\d+)(?=\s|$)/g;

  const permits: ParsedPermit[] = [];
  let match: RegExpExecArray | null;
  let rowNumber = 0;

  while ((match = pattern.exec(cleaned)) !== null) {
    rowNumber += 1;

    const permitNo = match[1].trim();
    const permittee = match[2].trim();
    const checkInRaw = match[3].trim();
    const checkOutRaw = match[4].trim();
    const guestCount = Number.parseInt(match[5], 10);

    permits.push({
      permit_no: permitNo,
      normalized_permit_no: normalizePermitNumber(permitNo),
      permittee,
      normalized_permittee: normalizeName(permittee),
      check_in: parseDlnrDate(checkInRaw),
      check_out: parseDlnrDate(checkOutRaw),
      guest_count: Number.isFinite(guestCount) ? guestCount : 0,
      row_number: rowNumber,
      raw_row: {
        permit_no: permitNo,
        permittee,
        check_in: checkInRaw,
        check_out: checkOutRaw,
        no_of_guests: guestCount,
      },
    });
  }

  return permits;
}

function scoreMatch(
  request: RequestCandidate,
  permit: ParsedPermit,
): Omit<MatchChoice, "request" | "permit"> | null {
  const submittedPermit = normalizePermitNumber(
    request.dlnr_permit_number || request.summit_permit_number,
  );

  const permitDistance =
    submittedPermit && permit.normalized_permit_no
      ? levenshtein(submittedPermit, permit.normalized_permit_no)
      : Number.POSITIVE_INFINITY;

  const exactPermit =
    submittedPermit.length > 0 &&
    submittedPermit === permit.normalized_permit_no;

  const submittedName = normalizeName(requestName(request));
  const nameScore = similarity(submittedName, permit.normalized_permittee);
  const exactName =
    submittedName.length > 0 &&
    submittedName === permit.normalized_permittee;

  const dateWithinStay =
    request.request_date >= permit.check_in &&
    request.request_date <= permit.check_out;

  const checkInMatches = request.request_date === permit.check_in;

  const checkOutMatches =
    request.exit_date != null &&
    request.exit_date === permit.check_out;

  if (exactPermit && dateWithinStay) {
    return {
      score: 100,
      method: "permit_number_and_dates",
      notes:
        `Exact permit number; request date ${request.request_date} ` +
        `falls within ${permit.check_in}–${permit.check_out}.`,
    };
  }

  if (exactPermit) {
    return {
      score: 98,
      method: "permit_number",
      notes:
        `Exact permit number; request date ${request.request_date} ` +
        `does not fall within ${permit.check_in}–${permit.check_out}.`,
    };
  }

  if (exactName && checkInMatches && checkOutMatches) {
    return {
      score: 95,
      method: "permittee_checkin_checkout",
      notes: "Exact permittee name, check-in date, and check-out date.",
    };
  }

  if (exactName && dateWithinStay) {
    return {
      score: 92,
      method: "permittee_and_dates",
      notes:
        `Exact permittee name; request date ${request.request_date} ` +
        `falls within the permit stay.`,
    };
  }

  if (
    permitDistance === 1 &&
    nameScore >= 0.95 &&
    dateWithinStay
  ) {
    return {
      score: 90,
      method: "fuzzy_permit_number_name_dates",
      notes:
        "Permit number differs by one character, with matching name and dates.",
    };
  }

  if (
    nameScore >= 0.88 &&
    dateWithinStay &&
    (checkOutMatches || request.exit_date == null)
  ) {
    return {
      score: 88,
      method: "fuzzy_permittee_and_dates",
      notes:
        `Similar permittee name (${Math.round(nameScore * 100)}%) ` +
        "and matching permit dates.",
    };
  }

  return null;
}

async function upsertPermits(
  supabase: SupabaseClientLike,
  reportId: string,
  permits: ParsedPermit[],
): Promise<ParsedPermit[]> {
  const stored: ParsedPermit[] = [];

  for (const permit of permits) {
    const { data: existing, error: existingError } = await supabase
      .from("ainapo_cabin_permits")
      .select("id")
      .eq("report_id", reportId)
      .eq("normalized_permit_no", permit.normalized_permit_no)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to check existing permit ${permit.permit_no}: ` +
          existingError.message,
      );
    }

    const values = {
      report_id: reportId,
      row_number: permit.row_number,
      permit_no: permit.permit_no,
      normalized_permit_no: permit.normalized_permit_no,
      permittee: permit.permittee,
      normalized_permittee: permit.normalized_permittee,
      phone: null,
      normalized_phone: null,
      check_in: permit.check_in,
      check_out: permit.check_out,
      guest_count: permit.guest_count,
      raw_row: permit.raw_row,
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("ainapo_cabin_permits")
        .update(values)
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(
          `Unable to update permit ${permit.permit_no}: ` +
            updateError.message,
        );
      }

      stored.push({ ...permit, id: existing.id });
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("ainapo_cabin_permits")
      .insert(values)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(
        `Unable to insert permit ${permit.permit_no}: ` +
          insertError.message,
      );
    }

    stored.push({ ...permit, id: inserted.id });
  }

  return stored;
}

async function loadCandidates(
  supabase: SupabaseClientLike,
  permits: ParsedPermit[],
): Promise<RequestCandidate[]> {
  const { data: gates, error: gateError } = await supabase
    .from("gates")
    .select("id, name");

  if (gateError) {
    throw new Error(`Unable to load gates: ${gateError.message}`);
  }

  const ainapoGate = (gates ?? []).find((gate: any) =>
    normalizeGateName(String(gate.name)).includes("ainapo")
  );

  if (!ainapoGate?.id) {
    throw new Error("Unable to locate the ʻĀinapō gate.");
  }

  const earliest = permits
    .map((permit) => permit.check_in)
    .sort()[0];

  const latest = permits
    .map((permit) => permit.check_out)
    .sort()
    .at(-1);

  const { data, error } = await supabase
    .from("daily_access_requests")
    .select(`
      id,
      request_date,
      exit_date,
      dlnr_permit_number,
      summit_permit_number,
      purpose,
      access_accounts (
        applicant_first_name,
        applicant_last_name,
        profiles!access_accounts_profile_id_fkey (
          first_name,
          last_name
        )
      )
    `)
    .eq("gate_id", ainapoGate.id)
    .eq("status", "approved")
    .gte("request_date", addDays(earliest, -31))
    .lte("request_date", addDays(latest, 31));

  if (error) {
    throw new Error(
      `Unable to load approved ʻĀinapō requests: ${error.message}`,
    );
  }

  return (data ?? []) as RequestCandidate[];
}

async function applyMatches(
  supabase: SupabaseClientLike,
  reportId: string,
  permits: ParsedPermit[],
  requests: RequestCandidate[],
): Promise<{
  matchedRequestCount: number;
  unmatchedPermitCount: number;
}> {
  const choicesByRequest = new Map<string, MatchChoice[]>();

  for (const request of requests) {
    for (const permit of permits) {
      const scored = scoreMatch(request, permit);

      if (!scored) continue;

      const choices = choicesByRequest.get(request.id) ?? [];

      choices.push({
        request,
        permit,
        ...scored,
      });

      choicesByRequest.set(request.id, choices);
    }
  }

  const matchedPermitIds = new Set<string>();
  let matchedRequestCount = 0;

  for (const choices of choicesByRequest.values()) {
    choices.sort((a, b) => b.score - a.score);

    const best = choices[0];
    const second = choices[1];

    /*
     * Do not auto-verify an ambiguous tie between two different permits.
     */
    if (
      second &&
      second.score === best.score &&
      second.permit.id !== best.permit.id
    ) {
      console.warn("Ambiguous Ainapo permit match:", {
        requestId: best.request.id,
        score: best.score,
        permitIds: [best.permit.id, second.permit.id],
      });

      continue;
    }

    if (!best.permit.id || best.score < 85) continue;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("daily_access_requests")
      .update({
        ainapo_permit_id: best.permit.id,
        ainapo_permit_verified: true,
        ainapo_permit_verified_at: now,
        ainapo_permit_match_method: best.method,
        ainapo_permit_match_confidence: best.score,
        ainapo_permit_match_notes:
          `${best.notes} Report ${reportId}; ` +
          `DLNR permit ${best.permit.permit_no}; ` +
          `permittee ${best.permit.permittee}.`,
      })
      .eq("id", best.request.id);

    if (error) {
      throw new Error(
        `Unable to verify request ${best.request.id}: ${error.message}`,
      );
    }

    matchedRequestCount += 1;
    matchedPermitIds.add(best.permit.id);
  }

  return {
    matchedRequestCount,
    unmatchedPermitCount:
      permits.filter(
        (permit) => permit.id && !matchedPermitIds.has(permit.id)
      ).length,
  };
}

export async function processAinapoPdf(args: {
  supabase: SupabaseClientLike;
  reportId: string;
  pdfBytes: Uint8Array;
}): Promise<{
  permit_count: number;
  matched_request_count: number;
  unmatched_permit_count: number;
  extracted_text_preview: string;
}> {
  const { supabase, reportId, pdfBytes } = args;
  const now = new Date().toISOString();

  await supabase
    .from("ainapo_permit_reports")
    .update({
      processing_status: "processing",
      last_checked_at: now,
      error_message: null,
      updated_at: now,
    })
    .eq("id", reportId);

  try {
    const document = await getDocumentProxy(pdfBytes);

    const extracted = await extractText(document, {
      mergePages: true,
    });

    const rawText = Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : String(extracted.text ?? "");

    if (typeof (document as any).destroy === "function") {
      await (document as any).destroy();
    }

    const parsedPermits = parsePermitRows(rawText);

    if (parsedPermits.length === 0) {
      throw new Error(
        "No DLNR permit rows could be extracted from the PDF.",
      );
    }

    const storedPermits = await upsertPermits(
      supabase,
      reportId,
      parsedPermits,
    );

    const candidates = await loadCandidates(
      supabase,
      storedPermits,
    );

    const matchResult = await applyMatches(
      supabase,
      reportId,
      storedPermits,
      candidates,
    );

    const completedAt = new Date().toISOString();

    const { error: reportUpdateError } = await supabase
      .from("ainapo_permit_reports")
      .update({
        processing_status: "complete",
        permit_count: storedPermits.length,
        matched_request_count: matchResult.matchedRequestCount,
        unmatched_permit_count: matchResult.unmatchedPermitCount,
        last_checked_at: completedAt,
        completed_at: completedAt,
        error_message: null,
        updated_at: completedAt,
      })
      .eq("id", reportId);

    if (reportUpdateError) {
      throw new Error(
        `Unable to complete report record: ` +
          reportUpdateError.message,
      );
    }

    return {
      permit_count: storedPermits.length,
      matched_request_count: matchResult.matchedRequestCount,
      unmatched_permit_count: matchResult.unmatchedPermitCount,
      extracted_text_preview: rawText.slice(0, 500),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const failedAt = new Date().toISOString();

    await supabase
      .from("ainapo_permit_reports")
      .update({
        processing_status: "error",
        last_checked_at: failedAt,
        error_message: message,
        updated_at: failedAt,
      })
      .eq("id", reportId);

    throw error;
  }
}
