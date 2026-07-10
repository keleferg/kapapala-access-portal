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

const OUT_DIR = path.join(process.cwd(), "bulk-id-import");
const OUT_FILE = path.join(OUT_DIR, "id-import-map.csv");

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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
      .order("applicant_last_name", { ascending: true })
      .order("applicant_first_name", { ascending: true })
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const accounts = await fetchAllActiveAccounts();

  const header = [
    "filename",
    "access_id",
    "applicant_email",
    "expires_at",
    "do_import",
    "access_account_id",
    "applicant_first_name",
    "applicant_last_name",
    "status",
    "current_id_document_path",
    "current_id_expires_at",
  ];

  const rows = [header];

  for (const account of accounts) {
    rows.push([
      "",
      account.access_id || "",
      account.applicant_email || "",
      "",
      "YES",
      account.id || "",
      account.applicant_first_name || "",
      account.applicant_last_name || "",
      account.status || "",
      account.id_document_path || "",
      account.id_expires_at || "",
    ]);
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  fs.writeFileSync(OUT_FILE, csv);

  console.log("");
  console.log(`Full mapping CSV created: ${OUT_FILE}`);
  console.log(`Active accounts exported: ${accounts.length}`);
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
