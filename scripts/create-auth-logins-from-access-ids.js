const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("@next/env").loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes("--dry-run");
const RESET_EXISTING = process.argv.includes("--reset-existing");
const FORCE_RELINK = process.argv.includes("--force-relink");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_FILE = path.join(
  process.cwd(),
  DRY_RUN ? "bulk-login-dry-run-report.csv" : "bulk-login-report.csv"
);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value ?? "").replaceAll('"', '""');
}

function toCsvRow(values) {
  return values.map((value) => `"${clean(value)}"`).join(",");
}

async function fetchAllAccessAccounts() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from("access_accounts")
      .select(
        [
          "id",
          "profile_id",
          "access_id",
          "status",
          "applicant_email",
          "applicant_first_name",
          "applicant_last_name",
        ].join(",")
      )
      .not("access_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...(data || []));

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchAllAuthUsers() {
  const pageSize = 1000;
  let page = 1;
  const users = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < pageSize) break;
    page += 1;
  }

  return users;
}

async function upsertProfile(userId, account, email) {
  const payload = {
    id: userId,
    email,
    first_name: account.applicant_first_name || null,
    last_name: account.applicant_last_name || null,
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}

async function linkAccountToProfile(accountId, userId) {
  const { error } = await supabase
    .from("access_accounts")
    .update({ profile_id: userId })
    .eq("id", accountId);

  if (error) throw error;
}

async function main() {
  console.log(DRY_RUN ? "Running dry run..." : "Creating/updating logins...");

  const accounts = await fetchAllAccessAccounts();
  const authUsers = await fetchAllAuthUsers();

  const authUserByEmail = new Map();

  for (const user of authUsers) {
    const email = normalizeEmail(user.email);
    if (email) authUserByEmail.set(email, user);
  }

  const emailCounts = new Map();

  for (const account of accounts) {
    const email = normalizeEmail(account.applicant_email);
    if (!email) continue;
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  }

  const report = [
    [
      "access_account_id",
      "access_id",
      "email",
      "status",
      "action",
      "auth_user_id",
      "message",
    ],
  ];

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let linked = 0;
  let failed = 0;

  for (const account of accounts) {
    const email = normalizeEmail(account.applicant_email);
    const accessId = String(account.access_id || "").trim();

    if (!email) {
      skipped++;
      report.push([
        account.id,
        accessId,
        "",
        account.status,
        "skipped",
        "",
        "Missing email",
      ]);
      continue;
    }

    if (!accessId) {
      skipped++;
      report.push([
        account.id,
        accessId,
        email,
        account.status,
        "skipped",
        "",
        "Missing Access ID",
      ]);
      continue;
    }

    if ((emailCounts.get(email) || 0) > 1) {
      skipped++;
      report.push([
        account.id,
        accessId,
        email,
        account.status,
        "skipped",
        "",
        "Duplicate email exists in access_accounts; review manually",
      ]);
      continue;
    }

    const password = accessId;
    const existingAuthUser = authUserByEmail.get(email);

    try {
      if (existingAuthUser) {
        const authUserId = existingAuthUser.id;

        if (account.profile_id && account.profile_id !== authUserId && !FORCE_RELINK) {
          skipped++;
          report.push([
            account.id,
            accessId,
            email,
            account.status,
            "skipped",
            authUserId,
            `Account profile_id points to ${account.profile_id}; use --force-relink only if you are sure`,
          ]);
          continue;
        }

        if (!DRY_RUN && RESET_EXISTING) {
          const { error } = await supabase.auth.admin.updateUserById(
            authUserId,
            { password }
          );

          if (error) throw error;

          updated++;
        }

        if (!DRY_RUN) {
          await upsertProfile(authUserId, account, email);

          if (!account.profile_id || account.profile_id !== authUserId) {
            await linkAccountToProfile(account.id, authUserId);
            linked++;
          }
        }

        skipped++;
        report.push([
          account.id,
          accessId,
          email,
          account.status,
          RESET_EXISTING
            ? DRY_RUN
              ? "would_reset_existing_password"
              : "reset_existing_password"
            : "existing_user_kept",
          authUserId,
          RESET_EXISTING
            ? "Existing auth user found; password set to Access ID"
            : "Existing auth user found; password not changed",
        ]);

        continue;
      }

      if (DRY_RUN) {
        created++;
        report.push([
          account.id,
          accessId,
          email,
          account.status,
          "would_create",
          "",
          "Would create auth user with Access ID as password",
        ]);
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: account.applicant_first_name || null,
          last_name: account.applicant_last_name || null,
          access_id: accessId,
          access_account_id: account.id,
        },
      });

      if (error) throw error;

      const user = data?.user;

      if (!user?.id) {
        throw new Error("Supabase did not return a user ID.");
      }

      await upsertProfile(user.id, account, email);
      await linkAccountToProfile(account.id, user.id);

      authUserByEmail.set(email, user);
      created++;
      linked++;

      report.push([
        account.id,
        accessId,
        email,
        account.status,
        "created",
        user.id,
        "Auth user created and linked to access account",
      ]);
    } catch (error) {
      failed++;
      report.push([
        account.id,
        accessId,
        email,
        account.status,
        "failed",
        existingAuthUser?.id || "",
        error.message || String(error),
      ]);
    }
  }

  fs.writeFileSync(
    REPORT_FILE,
    report.map((row) => toCsvRow(row)).join("\n") + "\n"
  );

  console.log("Done.");
  console.log(`Created: ${created}`);
  console.log(`Updated existing passwords: ${updated}`);
  console.log(`Linked accounts: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Report: ${REPORT_FILE}`);

  if (DRY_RUN) {
    console.log("");
    console.log("Dry run only. No users were created or changed.");
  }
}

main().catch((error) => {
  console.error("Bulk login setup failed:");
  console.error(error);
  process.exit(1);
});
