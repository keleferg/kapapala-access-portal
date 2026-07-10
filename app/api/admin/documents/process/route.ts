import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AnalyzeIDCommand, TextractClient } from "@aws-sdk/client-textract";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AWS_REGION = process.env.AWS_REGION || "us-west-2";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const ID_DOCUMENT_BUCKET =
  process.env.ID_DOCUMENT_BUCKET || "kapapala-documents";

type ProcessIdDocumentBody = {
  accessAccountId?: string;
  documentPath?: string;
  bucket?: string;
};

type ExtractedField = {
  value: string | null;
  confidence: number | null;
};

function normalizeKey(value: string | null | undefined) {
  return (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, monthRaw, dayRaw, yearRaw] = slashMatch;

    let year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (yearRaw.length === 2) {
      year += year > 40 ? 1900 : 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function calculateAge(dobIso: string | null) {
  if (!dobIso) return null;

  const today = new Date();
  const dob = new Date(`${dobIso}T00:00:00Z`);

  if (Number.isNaN(dob.getTime())) return null;

  let age = today.getUTCFullYear() - dob.getUTCFullYear();

  const birthdayThisYear = new Date(
    Date.UTC(today.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate())
  );

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  if (todayUtc < birthdayThisYear) {
    age -= 1;
  }

  return age;
}

function isPastDate(isoDate: string | null) {
  if (!isoDate) return false;

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  return isoDate < todayIso;
}

function looksLikeGovernmentId(documentType: string | null) {
  if (!documentType) return false;

  const normalized = documentType.toUpperCase();

  return (
    normalized.includes("DRIVER") ||
    normalized.includes("LICENSE") ||
    normalized.includes("LICENCE") ||
    normalized.includes("PASSPORT") ||
    normalized.includes("IDENTIFICATION") ||
    normalized.includes("IDENTITY") ||
    normalized.includes("STATE ID") ||
    normalized.includes("ID CARD")
  );
}

function getField(
  fieldsByKey: Map<string, ExtractedField>,
  possibleKeys: string[]
): ExtractedField {
  for (const key of possibleKeys) {
    const normalized = normalizeKey(key);

    if (fieldsByKey.has(normalized)) {
      return fieldsByKey.get(normalized) || { value: null, confidence: null };
    }
  }

  return { value: null, confidence: null };
}

function getValueText(field: any): string | null {
  return (
    field?.ValueDetection?.NormalizedValue?.Value ||
    field?.ValueDetection?.Text ||
    null
  );
}

function getFieldKey(field: any): string | null {
  return field?.Type?.NormalizedValue?.Value || field?.Type?.Text || null;
}

function buildWarningSummary(flags: string[]) {
  if (flags.length === 0) {
    return "No automated ID warnings were found.";
  }

  const messages: string[] = [];

  if (flags.includes("under_18")) {
    messages.push("Applicant appears to be under 18 based on the uploaded ID.");
  }

  if (flags.includes("expired_id")) {
    messages.push("Uploaded ID appears to be expired based on the parsed expiration date.");
  }

  if (flags.includes("government_id_uncertain")) {
    messages.push("The system could not confidently confirm that the uploaded document is a government-issued ID.");
  }

  if (flags.includes("missing_dob")) {
    messages.push("The system could not find a date of birth on the uploaded ID.");
  }

  if (flags.includes("missing_expiration")) {
    messages.push("The system could not find an expiration date on the uploaded ID.");
  }

  if (flags.includes("low_confidence")) {
    messages.push("One or more parsed ID fields had low confidence and should be reviewed manually.");
  }

  if (flags.includes("parser_failed")) {
    messages.push("The system was unable to automatically parse the uploaded ID.");
  }

  return messages.join(" ");
}

async function getAdminSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service configuration.");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAdmin(request: Request, adminSupabase: any) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase anon configuration.");
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      ok: false,
      error: "Missing authorization header.",
    };
  }

  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: "Unable to verify admin user.",
    };
  }

  const { data: accountRows, error: roleError } = await adminSupabase
    .from("access_accounts")
    .select("id, app_role, profile_id, applicant_email")
    .or(`profile_id.eq.${user.id},applicant_email.eq.${user.email}`)
    .limit(10);

  if (roleError) {
    return {
      ok: false,
      error: roleError.message || "Unable to verify admin role.",
    };
  }

  const isAdmin = (accountRows || []).some((row: any) =>
    ["admin", "super_user", "super_admin"].includes(row.app_role)
  );

  if (!isAdmin) {
    return {
      ok: false,
      error: "Only admins and super users can process ID documents.",
    };
  }

  return {
    ok: true,
    user,
  };
}

async function saveFailedReview({
  adminSupabase,
  accessAccountId,
  documentPath,
  errorMessage,
}: {
  adminSupabase: any;
  accessAccountId: string;
  documentPath: string;
  errorMessage: string;
}) {
  const flags = ["parser_failed"];
  const warningSummary = `${buildWarningSummary(flags)} ${errorMessage}`;

  const { data: review, error: insertError } = await adminSupabase
    .from("id_document_reviews")
    .insert({
      access_account_id: accessAccountId,
      document_path: documentPath,
      parser_provider: "aws_textract_analyze_id",
      parser_status: "failed_parse",
      is_under_18: false,
      is_expired: false,
      is_government_id_uncertain: true,
      is_low_confidence: true,
      needs_manual_review: true,
      review_flags: flags,
      warning_summary: warningSummary,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await adminSupabase
    .from("access_accounts")
    .update({
      id_review_status: "failed_parse",
      id_review_flags: flags,
      latest_id_document_review_id: review.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accessAccountId);

  if (updateError) {
    throw updateError;
  }

  return review.id;
}

export async function POST(request: Request) {
  let accessAccountId = "";
  let documentPath = "";

  try {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing AWS Textract credentials.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ProcessIdDocumentBody;

    accessAccountId = body.accessAccountId || "";
    documentPath = body.documentPath || "";

    const bucket = body.bucket || ID_DOCUMENT_BUCKET;

    if (!accessAccountId || !documentPath) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing accessAccountId or documentPath.",
        },
        { status: 400 }
      );
    }

    const adminSupabase = await getAdminSupabase();

    const adminCheck = await requireAdmin(request, adminSupabase);

    if (!adminCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          error: adminCheck.error,
        },
        { status: 403 }
      );
    }

    const { data: fileBlob, error: downloadError } = await adminSupabase.storage
      .from(bucket)
      .download(documentPath);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message || "Unable to download ID document.");
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const textract = new TextractClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const textractResult = await textract.send(
      new AnalyzeIDCommand({
        DocumentPages: [
          {
            Bytes: bytes,
          },
        ],
      })
    );

    const identityDocument = textractResult.IdentityDocuments?.[0];

    if (!identityDocument) {
      const reviewId = await saveFailedReview({
        adminSupabase,
        accessAccountId,
        documentPath,
        errorMessage: "Textract did not return an identity document.",
      });

      return NextResponse.json({
        success: false,
        reviewId,
        error: "Textract did not return an identity document.",
      });
    }

    const fieldsByKey = new Map<string, ExtractedField>();

    for (const field of identityDocument.IdentityDocumentFields || []) {
      const key = normalizeKey(getFieldKey(field));
      const value = getValueText(field);
      const confidence = field?.ValueDetection?.Confidence ?? null;

      if (key && value) {
        fieldsByKey.set(key, {
          value,
          confidence,
        });
      }
    }

    const dobField = getField(fieldsByKey, [
      "DATE_OF_BIRTH",
      "DOB",
      "BIRTH_DATE",
      "DATEOFBIRTH",
    ]);

    const expirationField = getField(fieldsByKey, [
      "EXPIRATION_DATE",
      "EXPIRY_DATE",
      "EXPIRY",
      "EXP",
      "DATE_OF_EXPIRATION",
      "DOCUMENT_EXPIRATION_DATE",
    ]);

    const documentTypeField = getField(fieldsByKey, [
      "DOCUMENT_TYPE",
      "ID_TYPE",
      "TYPE",
    ]);

    const issuingAuthorityField = getField(fieldsByKey, [
      "ISSUING_AUTHORITY",
      "ISSUER",
      "ISSUED_BY",
      "STATE",
      "COUNTRY",
    ]);

    const parsedDateOfBirth = toIsoDate(dobField.value);
    const parsedExpirationDate = toIsoDate(expirationField.value);
    const parsedDocumentType = documentTypeField.value;
    const parsedIssuingAuthority = issuingAuthorityField.value;

    const ageAtReview = calculateAge(parsedDateOfBirth);

    const isUnder18 = ageAtReview !== null && ageAtReview < 18;
    const isExpired = isPastDate(parsedExpirationDate);

    const lowConfidence =
      (dobField.confidence !== null && dobField.confidence < 70) ||
      (expirationField.confidence !== null && expirationField.confidence < 70) ||
      (documentTypeField.confidence !== null &&
        documentTypeField.confidence < 70);

    const governmentIdUncertain =
      !parsedDocumentType || !looksLikeGovernmentId(parsedDocumentType);

    const flags: string[] = [];

    if (!parsedDateOfBirth) flags.push("missing_dob");
    if (!parsedExpirationDate) flags.push("missing_expiration");
    if (isUnder18) flags.push("under_18");
    if (isExpired) flags.push("expired_id");
    if (governmentIdUncertain) flags.push("government_id_uncertain");
    if (lowConfidence) flags.push("low_confidence");

    const needsManualReview = flags.length > 0;
    const idReviewStatus = needsManualReview ? "warning" : "clear";
    const warningSummary = buildWarningSummary(flags);

    const { data: review, error: insertError } = await adminSupabase
      .from("id_document_reviews")
      .insert({
        access_account_id: accessAccountId,
        document_path: documentPath,
        parser_provider: "aws_textract_analyze_id",
        parser_status: "processed",
        parsed_date_of_birth: parsedDateOfBirth,
        parsed_expiration_date: parsedExpirationDate,
        parsed_document_type: parsedDocumentType,
        parsed_issuing_authority: parsedIssuingAuthority,
        dob_confidence: dobField.confidence,
        expiration_confidence: expirationField.confidence,
        document_type_confidence: documentTypeField.confidence,
        age_at_review: ageAtReview,
        is_under_18: isUnder18,
        is_expired: isExpired,
        is_government_id_uncertain: governmentIdUncertain,
        is_low_confidence: lowConfidence,
        needs_manual_review: needsManualReview,
        review_flags: flags,
        warning_summary: warningSummary,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await adminSupabase
      .from("access_accounts")
      .update({
        id_review_status: idReviewStatus,
        id_review_flags: flags,
        latest_id_document_review_id: review.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accessAccountId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      reviewId: review.id,
      idReviewStatus,
      flags,
      parsed: {
        dateOfBirth: parsedDateOfBirth,
        expirationDate: parsedExpirationDate,
        documentType: parsedDocumentType,
        issuingAuthority: parsedIssuingAuthority,
        ageAtReview,
      },
      warningSummary,
    });
  } catch (error) {
    try {
      if (accessAccountId && documentPath) {
        const adminSupabase = await getAdminSupabase();

        await saveFailedReview({
          adminSupabase,
          accessAccountId,
          documentPath,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown parser failure.",
        });
      }
    } catch {
      // Avoid masking the original error.
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process ID document.",
      },
      { status: 500 }
    );
  }
}