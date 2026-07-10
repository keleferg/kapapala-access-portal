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
const DOCUMENT_TYPE = "Driver License";
const REQUEST_TIMEOUT_MS = 60_000;
const CHECKPOINT_EVERY = 10;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Make sure those values exist in your local environment.");
  process.exit(1);
}

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetchWithTimeout,
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

function writeReport(reportRows) {
  fs.writeFileSync(
    REPORT_FILE,
    reportRows.map((row) => row.map(csvEscape).join(",")).join("\n")
  );
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

function existingDocumentKey(accessAccountId, filename) {
  return `${accessAccountId}::${filename.trim().toLowerCase()}`;
}

async function loadExistingDocuments() {
  const existing = new Map();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("access_account_documents")
      .select("id, access_account_id, original_filename, storage_path, expires_at")
      .eq("document_type", DOCUMENT_TYPE)
      .eq("storage_bucket", BUCKET)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load existing documents: ${error.message}`);
    }

    for (const doc of data || []) {
      if (!doc.access_account_id || !doc.original_filename) {
        continue;
      }

      existing.set(
        existingDocumentKey(doc.access_account_id, doc.original_filename),
        doc
      );
    }

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return existing;
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

async function syncAccountDocumentPath(account, storagePath, expiresAt) {
  const updatePayload = {
    id_document_path: storagePath,
  };

  // Important: do not clear an existing expiration date when the import CSV is blank.
  if (expiresAt) {
    updatePayload.id_expires_at = expiresAt;
  }

  const { error } = await supabase
    .from("access_accounts")
    .update(updatePayload)
    .eq("id", account.id);

  return error;
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
  const existingDocuments = await loadExistingDocuments();

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

  const totals = {
    totalRows: rows.length,
    imported: 0,
    skipped: 0,
    dryRun: 0,
    errors: 0,
    existingSkipped: 0,
    accountSynced: 0,
  };

  console.log("========================================");
  console.log("Kapāpala ID Document Import");
  console.log("========================================");
  console.log(`Rows in map: ${rows.length}`);
  console.log(`Existing documents loaded: ${existingDocuments.size}`);
  console.log(`Dry run: ${DRY_RUN ? "YES" : "NO"}`);
  console.log(`Allow overwrite: ${ALLOW_OVERWRITE ? "YES" : "NO"}`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS / 1000}s`);
  console.log(`Report file: ${REPORT_FILE}`);
  console.log("========================================");

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;

    const filename = row.filename?.trim();
    const expiresAt = row.expires_at?.trim() || null;
    const doImport = (row.do_import || "YES").trim().toUpperCase();

    console.log(`[${rowNumber}/${rows.length}] ${filename || "(missing filename)"}`);

    if (doImport === "NO" || doImport === "FALSE" || doImport === "SKIP") {
      totals.skipped++;

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
      totals.skipped++;

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
      totals.errors++;

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

    let account;
    let matchError;

    try {
      const result = await findActiveAccount(row);
      account = result.account;
      matchError = result.error;
    } catch (error) {
      totals.errors++;

      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        "",
        "",
        "error",
        `Account lookup failed: ${error.message}`,
        "",
        expiresAt || "",
      ]);
      continue;
    }

    if (matchError || !account) {
      totals.errors++;

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

    const existingKey = existingDocumentKey(account.id, filename);
    const existingDocument = existingDocuments.get(existingKey);

    if (existingDocument && !ALLOW_OVERWRITE) {
      totals.existingSkipped++;

      let syncMessage = "Already exists in access_account_documents. Skipped.";

      if (!account.id_document_path && existingDocument.storage_path) {
        const syncError = await syncAccountDocumentPath(
          account,
          existingDocument.storage_path,
          expiresAt || existingDocument.expires_at || null
        );

        if (syncError) {
          syncMessage += ` Account sync failed: ${syncError.message}`;
        } else {
          totals.accountSynced++;
          syncMessage += " Account id_document_path synced.";
        }
      }

      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "skipped_existing_document",
        syncMessage,
        existingDocument.storage_path || "",
        expiresAt || existingDocument.expires_at || "",
      ]);

      console.log(`  SKIP existing document: ${existingDocument.storage_path}`);
      continue;
    }

    if (account.id_document_path && !ALLOW_OVERWRITE) {
      totals.skipped++;

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

      console.log(`  SKIP account already has id_document_path: ${account.id_document_path}`);
      continue;
    }

    const ext = safeExtension(filename);
    const storagePath = `${account.id}/driver-license-import-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    if (DRY_RUN) {
      totals.dryRun++;

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

    let fileBuffer;
    let mimeType;

    try {
      fileBuffer = fs.readFileSync(localFilePath);
      mimeType = getMimeType(filename);
    } catch (error) {
      totals.errors++;

      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "error",
        `Failed to read local file: ${error.message}`,
        storagePath,
        expiresAt || "",
      ]);
      continue;
    }

    console.log(`  Uploading ${fileBuffer.length} bytes to ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      totals.errors++;

      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "error",
        `Upload failed: ${uploadError.message}`,
        storagePath,
        expiresAt || "",
      ]);

      console.log(`  ERROR upload failed: ${uploadError.message}`);
      continue;
    }

    console.log("  Upload complete. Inserting document row.");

    const { error: documentError } = await supabase
      .from("access_account_documents")
      .insert({
        access_account_id: account.id,
        document_type: DOCUMENT_TYPE,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size: fileBuffer.length,
        expires_at: expiresAt,
      });

    if (documentError) {
      totals.errors++;

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

      console.log(`  ERROR document insert failed: ${documentError.message}`);
      continue;
    }

    const syncError = await syncAccountDocumentPath(account, storagePath, expiresAt);

    if (syncError) {
      totals.errors++;

      reportRows.push([
        filename,
        row.access_id || "",
        row.applicant_email || "",
        account.id,
        matchedName,
        "partial_success",
        `Uploaded and inserted document row, but failed to update account: ${syncError.message}`,
        storagePath,
        expiresAt || "",
      ]);

      console.log(`  PARTIAL account update failed: ${syncError.message}`);
      continue;
    }

    existingDocuments.set(existingKey, {
      access_account_id: account.id,
      original_filename: filename,
      storage_path: storagePath,
      expires_at: expiresAt,
    });

    totals.imported++;

    reportRows.push([
      filename,
      row.access_id || "",
      row.applicant_email || "",
      account.id,
      matchedName,
      "uploaded",
      "Uploaded, inserted document row, and updated account.",
      storagePath,
      expiresAt || "",
    ]);

    console.log("  DONE uploaded.");

    if (rowNumber % CHECKPOINT_EVERY === 0) {
      writeReport(reportRows);
      console.log(`  Checkpoint saved: ${REPORT_FILE}`);
    }
  }

  writeReport(reportRows);

  console.log("========================================");
  console.log("Import complete");
  console.log("========================================");
  console.log(`Total rows: ${totals.totalRows}`);
  console.log(`Imported: ${totals.imported}`);
  console.log(`Skipped: ${totals.skipped}`);
  console.log(`Skipped existing documents: ${totals.existingSkipped}`);
  console.log(`Dry-run matches: ${totals.dryRun}`);
  console.log(`Account paths synced from existing docs: ${totals.accountSynced}`);
  console.log(`Errors: ${totals.errors}`);
  console.log(`Report written to: ${REPORT_FILE}`);
  console.log("========================================");

  if (totals.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal import error:");
  console.error(error);
  process.exit(1);
});
