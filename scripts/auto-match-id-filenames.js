require("@next/env").loadEnvConfig(process.cwd());

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const IMPORT_DIR = path.join(process.cwd(), "bulk-id-import");
const DOCUMENTS_DIR = path.join(IMPORT_DIR, "documents");

const REVIEW_FILE = path.join(IMPORT_DIR, "auto-match-review.csv");
const AUTO_MAP_FILE = path.join(IMPORT_DIR, "id-import-map.autofilled.csv");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
]);

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ʻ|’|‘|`/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function tokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function listDocumentFiles() {
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    console.error(`Missing folder: ${DOCUMENTS_DIR}`);
    process.exit(1);
  }

  return fs
    .readdirSync(DOCUMENTS_DIR)
    .filter((filename) => {
      const fullPath = path.join(DOCUMENTS_DIR, filename);
      const ext = path.extname(filename).toLowerCase();
      return fs.statSync(fullPath).isFile() && ALLOWED_EXTENSIONS.has(ext);
    })
    .sort((a, b) => a.localeCompare(b));
}

async function fetchAllActiveAccounts() {
  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
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
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = data || [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

function buildAccountSearchData(account) {
  const first = account.applicant_first_name || "";
  const last = account.applicant_last_name || "";
  const email = account.applicant_email || "";
  const accessId = account.access_id || "";

  const firstTokens = tokens(first);
  const lastTokens = tokens(last);
  const fullTokens = unique([...firstTokens, ...lastTokens]);

  const emailUser = email.includes("@") ? email.split("@")[0] : email;

  return {
    ...account,
    _firstNorm: normalizeText(first),
    _lastNorm: normalizeText(last),
    _fullNorm: normalizeText(`${first} ${last}`),
    _firstCompact: compact(first),
    _lastCompact: compact(last),
    _fullCompact: compact(`${first} ${last}`),
    _lastFirstCompact: compact(`${last} ${first}`),
    _emailUserCompact: compact(emailUser),
    _accessId: String(accessId || "").trim(),
    _firstTokens: firstTokens,
    _lastTokens: lastTokens,
    _fullTokens: fullTokens,
  };
}

function scoreFileAgainstAccount(filename, account) {
  const base = path.basename(filename, path.extname(filename));
  const fileNorm = normalizeText(base);
  const fileCompact = compact(base);

  let score = 0;
  const reasons = [];

  if (account._accessId && fileNorm.includes(account._accessId)) {
    score += 1000;
    reasons.push("access_id_in_filename");
  }

  if (account._emailUserCompact && account._emailUserCompact.length >= 5) {
    if (fileCompact.includes(account._emailUserCompact)) {
      score += 750;
      reasons.push("email_username_in_filename");
    }
  }

  if (account._fullCompact && fileCompact.includes(account._fullCompact)) {
    score += 650;
    reasons.push("first_last_exact");
  }

  if (
    account._lastFirstCompact &&
    fileCompact.includes(account._lastFirstCompact)
  ) {
    score += 650;
    reasons.push("last_first_exact");
  }

  if (
    account._firstCompact &&
    account._lastCompact &&
    account._firstCompact.length >= 2 &&
    account._lastCompact.length >= 2 &&
    fileCompact.includes(account._firstCompact) &&
    fileCompact.includes(account._lastCompact)
  ) {
    score += 500;
    reasons.push("first_and_last_present");
  }

  let matchedLastTokens = 0;
  for (const token of account._lastTokens) {
    if (token.length >= 3 && fileNorm.includes(token)) {
      matchedLastTokens++;
    }
  }

  let matchedFirstTokens = 0;
  for (const token of account._firstTokens) {
    if (token.length >= 3 && fileNorm.includes(token)) {
      matchedFirstTokens++;
    }
  }

  if (matchedLastTokens > 0) {
    score += matchedLastTokens * 90;
    reasons.push(`last_tokens_${matchedLastTokens}`);
  }

  if (matchedFirstTokens > 0) {
    score += matchedFirstTokens * 70;
    reasons.push(`first_tokens_${matchedFirstTokens}`);
  }

  const totalNameTokens = account._fullTokens.filter((t) => t.length >= 3).length;
  const matchedNameTokens = account._fullTokens.filter(
    (t) => t.length >= 3 && fileNorm.includes(t)
  ).length;

  if (totalNameTokens > 0 && matchedNameTokens === totalNameTokens) {
    score += 250;
    reasons.push("all_name_tokens_present");
  } else if (matchedNameTokens >= 2) {
    score += 120;
    reasons.push(`multiple_name_tokens_${matchedNameTokens}`);
  }

  return {
    score,
    reasons,
  };
}

function chooseBestMatch(filename, accounts) {
  const candidates = accounts
    .map((account) => {
      const result = scoreFileAgainstAccount(filename, account);
      return {
        account,
        score: result.score,
        reasons: result.reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      confidence: "NO_MATCH",
      best: null,
      second: null,
      candidates: [],
      message: "No account name/access_id/email matched filename.",
    };
  }

  const best = candidates[0];
  const second = candidates[1] || null;
  const gap = second ? best.score - second.score : best.score;

  let confidence = "REVIEW";

  if (best.score >= 1000 && gap >= 200) {
    confidence = "EXACT_ACCESS_ID";
  } else if (best.score >= 650 && gap >= 200) {
    confidence = "HIGH";
  } else if (best.score >= 500 && gap >= 150) {
    confidence = "GOOD";
  } else if (best.score >= 250 && gap >= 120) {
    confidence = "POSSIBLE";
  } else {
    confidence = "AMBIGUOUS";
  }

  return {
    confidence,
    best,
    second,
    candidates: candidates.slice(0, 5),
    message:
      confidence === "AMBIGUOUS"
        ? "Multiple possible account matches. Manual review required."
        : "Best match selected by filename.",
  };
}

async function main() {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });

  const files = listDocumentFiles();
  const accounts = (await fetchAllActiveAccounts()).map(buildAccountSearchData);

  const reviewRows = [
    [
      "filename",
      "confidence",
      "score",
      "reason",
      "matched_access_account_id",
      "matched_access_id",
      "matched_email",
      "matched_first_name",
      "matched_last_name",
      "second_best_access_id",
      "second_best_name",
      "second_best_score",
      "message",
    ],
  ];

  const mapRows = [
    [
      "filename",
      "access_id",
      "applicant_email",
      "expires_at",
      "do_import",
      "access_account_id",
      "applicant_first_name",
      "applicant_last_name",
      "match_confidence",
      "match_score",
      "match_reason",
    ],
  ];

  const counts = {};

  for (const filename of files) {
    const match = chooseBestMatch(filename, accounts);
    counts[match.confidence] = (counts[match.confidence] || 0) + 1;

    const best = match.best;
    const second = match.second;

    reviewRows.push([
      filename,
      match.confidence,
      best ? best.score : "",
      best ? best.reasons.join("|") : "",
      best ? best.account.id : "",
      best ? best.account.access_id || "" : "",
      best ? best.account.applicant_email || "" : "",
      best ? best.account.applicant_first_name || "" : "",
      best ? best.account.applicant_last_name || "" : "",
      second ? second.account.access_id || "" : "",
      second
        ? `${second.account.applicant_first_name || ""} ${
            second.account.applicant_last_name || ""
          }`.trim()
        : "",
      second ? second.score : "",
      match.message,
    ]);

    const safeAutoImport =
      match.confidence === "EXACT_ACCESS_ID" ||
      match.confidence === "HIGH" ||
      match.confidence === "GOOD";

    mapRows.push([
      filename,
      best ? best.account.access_id || "" : "",
      best ? best.account.applicant_email || "" : "",
      "",
      safeAutoImport ? "YES" : "NO",
      best ? best.account.id : "",
      best ? best.account.applicant_first_name || "" : "",
      best ? best.account.applicant_last_name || "" : "",
      match.confidence,
      best ? best.score : "",
      best ? best.reasons.join("|") : "",
    ]);
  }

  fs.writeFileSync(
    REVIEW_FILE,
    reviewRows.map((row) => row.map(csvEscape).join(",")).join("\n")
  );

  fs.writeFileSync(
    AUTO_MAP_FILE,
    mapRows.map((row) => row.map(csvEscape).join(",")).join("\n")
  );

  console.log("");
  console.log(`Files scanned: ${files.length}`);
  console.log(`Active accounts loaded: ${accounts.length}`);
  console.log("");
  console.log("Match summary:");
  for (const [key, value] of Object.entries(counts).sort()) {
    console.log(`  ${key}: ${value}`);
  }
  console.log("");
  console.log(`Review file: ${REVIEW_FILE}`);
  console.log(`Auto-filled map: ${AUTO_MAP_FILE}`);
  console.log("");
  console.log("Review AMBIGUOUS, POSSIBLE, and NO_MATCH rows before importing.");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
