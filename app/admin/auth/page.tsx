"use client";

import { useMemo, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useAccessAccounts } from "../../../lib/hooks/useAccessAccounts";
import { getSupabaseClient } from "../../../lib/supabaseClient";

type AppRole = "user" | "admin" | "super_user";

type AccountStatus =
  | "active"
  | "pending"
  | "expired"
  | "suspended"
  | "revoked"
  | "denied";

type Applicant = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AccessAccount = {
  id: string;
  access_id?: string | null;
  status: AccountStatus | string;
  app_role?: AppRole | null;
  applicant_first_name?: string | null;
  applicant_last_name?: string | null;
  applicant_email?: string | null;
  email?: string | null;
  applicant?: Applicant | null;
};

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "super_user", label: "Super User" },
];

function getTone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function formatStatus(status: string) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getAccountName(account: AccessAccount) {
  const firstName =
    account.applicant?.first_name?.trim() ||
    account.applicant_first_name?.trim() ||
    "";

  const lastName =
    account.applicant?.last_name?.trim() ||
    account.applicant_last_name?.trim() ||
    "";

  return `${firstName} ${lastName}`.trim() || "Unknown Applicant";
}

function getAccountEmail(account: AccessAccount) {
  return (
    account.applicant?.email ||
    account.applicant_email ||
    account.email ||
    ""
  );
}

export default function AuthAndRolesPage() {
  const {
    accounts,
    loading,
    error,
    refresh,
  }: {
    accounts: AccessAccount[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
  } = useAccessAccounts() as any;

  const [search, setSearch] = useState("");
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const searchableText = [
        getAccountName(account),
        getAccountEmail(account),
        account.access_id,
        account.status,
        account.app_role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !query || searchableText.includes(query);
    });
  }, [accounts, search]);

  const userCount = accounts.filter(
    (account) => (account.app_role || "user") === "user"
  ).length;

  const adminCount = accounts.filter(
    (account) => account.app_role === "admin"
  ).length;

  const superUserCount = accounts.filter(
    (account) => account.app_role === "super_user"
  ).length;

  async function updateAccountRole(account: AccessAccount, role: AppRole) {
    const currentRole = account.app_role || "user";

    if (currentRole === role) {
      return;
    }

    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";

    const confirmed = window.confirm(
      `Change account role?\n\nName: ${accountName}\nAccess ID: ${accessId}\n\nCurrent role: ${currentRole}\nNew role: ${role}`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingAccountId(account.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("access_accounts")
        .update({
          app_role: role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (error) {
        throw error;
      }

      setActionSuccess(`${accountName} role updated.`);
      await refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update account role."
      );
    } finally {
      setUpdatingAccountId(null);
    }
  }

  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Auth & Roles</h2>
        <span>
          Manage account roles separately from access account operations.
        </span>
      </div>

      <Card title="Role Summary">
        <div className="profile-metric-grid">
          <div>
            <span>Users</span>
            <strong>{userCount}</strong>
          </div>

          <div>
            <span>Admins</span>
            <strong>{adminCount}</strong>
          </div>

          <div>
            <span>Super Users</span>
            <strong>{superUserCount}</strong>
          </div>

          <div>
            <span>Total Accounts</span>
            <strong>{accounts.length}</strong>
          </div>
        </div>
      </Card>

      <Card title="Account Roles">
        <div className="account-toolbar">
          <input
            aria-label="Search accounts"
            placeholder="Search by name, email, Access ID, status, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <button
            className="button secondary"
            type="button"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>

        {actionSuccess && (
          <div className="success-callout">
            <strong>Role updated</strong>
            <p>{actionSuccess}</p>
          </div>
        )}

        {actionError && (
          <div className="error-callout">
            <strong>Unable to update role</strong>
            <p>{actionError}</p>
          </div>
        )}

        {loading && <p className="muted-text">Loading accounts...</p>}

        {error && (
          <div className="error-callout">
            <strong>Unable to load accounts</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && filteredAccounts.length === 0 && (
          <p className="muted-text">No accounts match your search.</p>
        )}

        {!loading && !error && filteredAccounts.length > 0 && (
          <div className="auth-role-list">
            <div className="auth-role-row auth-role-row-header">
              <span>Name</span>
              <span>Status</span>
              <span>Role</span>
            </div>

            {filteredAccounts.map((account) => {
              const currentRole = account.app_role || "user";
              const isUpdating = updatingAccountId === account.id;

              return (
                <div className="auth-role-row" key={account.id}>
                  <div className="auth-role-name">
                    <strong>{getAccountName(account)}</strong>
                  </div>

                  <div>
                    <StatusBadge
                      label={formatStatus(account.status)}
                      tone={getTone(account.status)}
                    />
                  </div>

                  <fieldset
                    className="auth-role-radio-group"
                    disabled={isUpdating}
                  >
                    <legend className="sr-only">
                      Role for {getAccountName(account)}
                    </legend>

                    {ROLE_OPTIONS.map((role) => (
                      <label key={role.value} className="auth-role-radio">
                        <input
                          type="radio"
                          name={`role-${account.id}`}
                          value={role.value}
                          checked={currentRole === role.value}
                          disabled={isUpdating}
                          onChange={() => void updateAccountRole(account, role.value)}
                        />

                        <span>{role.label}</span>
                      </label>
                    ))}

                    {isUpdating && (
                      <span className="auth-role-updating">Updating...</span>
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AppShell>
  );
}