const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("@next/env").loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_OVERWRITE = process.argv.includes("--overwrite");

const PROJECT_ROOT = process.cwd();
const IMPORT_DIR = path.join(PROJECT_ROOT, "bulk-id-import");
const DOCUMENTS_DIR = path.join(IMPORT_DIR, "documents");
const MAP_FILE = path.join(IMPORT_DIR, "id-import-map.csv");
const REPORT_FILE = path.join(
  IMPORT_DIR,
  DRY_RUN ? "id-import-dry-run-report.csv" : "id-import-upload-report.csv"
);

const BUCKET = "kapapala-documents";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Make sure those values exist in your local environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });

    return row;
  });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";

  return "application/octet-stream";
}

function safeExtension(filename) {
  const ext = path.extname(filename).replace(".", "").toLowerCase();

  if (["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
    return ext;
  }

  return "upload";
}

async function findActiveAccount(row) {
  const accessId = row.access_id?.trim();
  const email = row.applicant_email?.trim();

  let query = supabase
    .from("access_accounts")
    .select(`
      id,
      access_id,
      applicant_email,
      applicant_first_name,
      applicant_last_name,
      status,
      id_document_path,
      id_expires_at
    `)
    .eq("status", "active")
    .limit(2);

  if (accessId) {
    query = query.eq("access_id", accessId);
  } else if (email) {
    query = query.ilike("applicant_email", email);
  } else {
    return {
      account: null,
      error: "Missing access_id and applicant_email.",
    };
  }

  const { data, error } = await query;

  if (error) {
    return {
      account: null,
      error: error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      account: null,
      error: "No active account matched.",
    };
  }

  if (data.length > 1) {
    return {
      account: null,
      error: "Multiple active accounts matched.",
    };
  }

  return {
    account: data[0],
    error: null,
  };
}

async function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`Missing mapping file: ${MAP_FILE}`);
    console.error("Put your CSV at: bulk-id-import/id-import-map.csv");
    process.exit(1);
  }

  if (!fs.existsSync(DOCUMENTS_DIR)) {
    console.error(`Missing documents folder: ${DOCUMENTS_DIR}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(MAP_FILE, "utf8"));

  const reportRows = [
    [
      "filename",
      "access_id",
      "applicant_email",
      "matched_account_id",
      "matched_name",
      "status",
      "message",
      "storage_path",
      "expires_at",
    ],
  ];

  for (const row of rows) {
    const filename = row.filename?.trim();
    const expiresAt = row.expires_at?.trim() || null;
    const doImport = (row.do_import || "YES").trim().toUpperCase();

    if (doImport === "NO" || doImport === "FALSE" || doImport === "SKIP") {
      reportRows.push([
        filename || "",
        row.access_id || "",
        row.applicant_email || "",
        "",
        "",
        "skipped",
        "do_import is not YES.",
        "",
        expiresAt || "",
      ]);
      continue;
    }

    if (!filename) {
      reportRows.push([
        "",
        row.access_id || "",
        row.applicant_email || "",
        "",
        "",
        "skipped",
        "Missing filename.",
        "",
        expiresAt || "",
      ]);
      continue;
    }

    const localFilePath = path.join(DOCUMENTS_DIR, filename);

    if (!fs.existsSync(localFilePath)) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        "",
        "",
        "error",
        "Local file not found.",
        "",
        expiresAt || "",
      ]);
      continue;
    }

    const { account, error: matchError } = await findActiveAccount(row);

    if (matchError || !account) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        "",
        "",
        "error",
        matchError || "No account matched.",
        "",
        expiresAt || "",
      ]);
      continue;
    }

    const matchedName = `${account.applicant_first_name || ""} ${
      account.applicant_last_name || ""
    }`.trim();

    if (account.id_document_path && !ALLOW_OVERWRITE) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "skipped",
        "Account already has id_document_path. Use --overwrite to replace.",
        account.id_document_path,
        expiresAt || "",
      ]);
      continue;
    }

    const ext = safeExtension(filename);
    const storagePath = `${account.id}/driver-license-import-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    if (DRY_RUN) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "dry_run_match",
        "Matched active account. No upload performed.",
        storagePath,
        expiresAt || "",
      ]);
      continue;
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const mimeType = getMimeType(filename);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "error",
        uploadError.message,
        storagePath,
        expiresAt || "",
      ]);
      continue;
    }

    const { error: documentError } = await supabase
      .from("access_account_documents")
      .insert({
        access_account_id: account.id,
        document_type: "Driver License",
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size: fileBuffer.length,
        expires_at: expiresAt,
      });

    if (documentError) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "error",
        `Uploaded file but failed to insert document row: ${documentError.message}`,
        storagePath,
        expiresAt || "",
      ]);
      continue;
    }

    const accountUpdatePayload = {
      id_document_path: storagePath,
    };

    if (expiresAt) {
      accountUpdatePayload.id_expires_at = expiresAt;
    }

    const { error: accountUpdateError } = await supabase
      .from("access_accounts")
      .update(accountUpdatePayload)
      .eq("id", account.id);

    if (accountUpdateError) {
      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "error",
        `Document row inserted but failed to update access account: ${accountUpdateError.message}`,
        storagePath,
        expiresAt || "",
      ]);
      continue;
    }

    await supabase.from("timeline_events").insert({
      access_account_id: account.id,
      event_type: "driver_license_imported",
      event_title: "Driver License Imported",
      event_body: `${filename} was bulk imported to the access account.`,
    });

    reportRows.push([
      filename,
      row.access_id || "",
      row.applicant_email || "",
      account.id,
      matchedName,
      "uploaded",
      "Uploaded and linked successfully.",
      storagePath,
      expiresAt || "",
    ]);
  }

  const reportCsv = reportRows
    .map((cells) => cells.map(csvEscape).join(","))
    .join("\n");

  fs.writeFileSync(REPORT_FILE, reportCsv);

  console.log("");
  console.log(DRY_RUN ? "Dry run complete." : "Upload complete.");
  console.log(`Report written to: ${REPORT_FILE}`);
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
