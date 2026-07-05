"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { getSupabaseClient } from "../../lib/supabaseClient";

function getTone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getAccountName(account: any) {
  const applicant = account?.applicant;

  const firstName =
    applicant?.first_name?.trim() ||
    account?.applicant_first_name?.trim() ||
    "";

  const lastName =
    applicant?.last_name?.trim() ||
    account?.applicant_last_name?.trim() ||
    "";

  return `${firstName} ${lastName}`.trim() || "Unknown Applicant";
}

export default function AccessAccountManagement() {
  const { accounts, loading, error, refresh } = useAccessAccounts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null
  );
  const [revokingAccountId, setRevokingAccountId] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const applicant = account.applicant;

      const vehicleText =
        account.vehicles
          ?.map((vehicle) => `${vehicle.label} ${vehicle.license_plate}`)
          .join(" ")
          .toLowerCase() || "";

      const searchableText = [
        account.access_id,
        account.status,
        account.organization,
        applicant?.first_name,
        applicant?.last_name,
        applicant?.email,
        applicant?.phone,
        vehicleText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        statusFilter === "all" || account.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [accounts, search, statusFilter]);

  const selected = filteredAccounts[0] || accounts[0];

  const activeCount = accounts.filter(
    (account) => account.status === "active"
  ).length;

  const pendingCount = accounts.filter(
    (account) => account.status === "pending"
  ).length;

  const suspendedCount = accounts.filter(
    (account) => account.status === "suspended"
  ).length;

  async function revokeAccessAccount(account: any) {
    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";

    setActionError(null);

    const confirmed = window.confirm(
      `Revoke this access account?\n\nName: ${accountName}\nAccess ID: ${accessId}\n\nThis will preserve account history but prevent the account from being treated as active.`
    );

    if (!confirmed) return;

    setRevokingAccountId(account.id);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("access_accounts")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (error) {
        console.error("Unable to revoke access account:", error);
        setActionError(error.message || "Unable to revoke access account.");
        return;
      }

      await refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to revoke access account."
      );
    } finally {
      setRevokingAccountId(null);
    }
  }

  async function deleteAccessAccount(account: any) {
    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";

    setActionError(null);

    const confirmed = window.confirm(
      `Delete this access account?\n\nName: ${accountName}\nAccess ID: ${accessId}\n\nThis is permanent and cannot be undone.`
    );

    if (!confirmed) return;

    const password = window.prompt(
      "Enter your admin password to confirm deletion:"
    );

    if (!password) return;

    setDeletingAccountId(account.id);

    try {
      const supabase = getSupabaseClient() as any;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.email) {
        setActionError("Unable to verify the current admin user.");
        return;
      }

      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (passwordError) {
        setActionError("Password verification failed. Account was not deleted.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("access_accounts")
        .delete()
        .eq("id", account.id);

      if (deleteError) {
        console.error("Unable to delete access account:", deleteError);
        setActionError(
          deleteError.message ||
            "Unable to delete access account. If this account has request history, use Revoke Account instead."
        );
        return;
      }

      await refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to delete access account."
      );
    } finally {
      setDeletingAccountId(null);
    }
  }

  return (
    <div className="account-management-layout">
      <Card title="Access Accounts">
        <div className="profile-metric-grid" style={{ marginBottom: 18 }}>
          <div>
            <span>Active</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </div>
          <div>
            <span>Suspended</span>
            <strong>{suspendedCount}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{accounts.length}</strong>
          </div>
        </div>

        <div className="account-toolbar">
          <input
            aria-label="Search access accounts"
            placeholder="Search by name, Access ID, phone, email, or license plate"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <button className="button primary" type="button" onClick={refresh}>
            Refresh
          </button>
        </div>

        <div className="filter-chip-row">
          {["all", "active", "pending", "expired", "suspended", "revoked"].map(
            (status) => (
              <button
                key={status}
                className={`filter-chip ${
                  statusFilter === status ? "active" : ""
                }`}
                type="button"
                onClick={() => setStatusFilter(status)}
              >
                {formatStatus(status)}
              </button>
            )
          )}
        </div>

        {actionError && (
          <div className="error-callout">
            <strong>Unable to complete action</strong>
            <p>{actionError}</p>
          </div>
        )}

        {loading && <p className="muted-text">Loading access accounts...</p>}

        {error && (
          <div className="error-callout">
            <strong>Unable to load access accounts</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && filteredAccounts.length === 0 && (
          <p className="muted-text">No access accounts match your search.</p>
        )}

        {!loading && !error && filteredAccounts.length > 0 && (
          <div className="accounts-table">
            <div>
              <span>Access ID</span>
              <span>Name</span>
              <span>Status</span>
              <span>Expires</span>
              <span>Last Visit</span>
              <span>Trips</span>
              <span>Vehicles</span>
            </div>

            {filteredAccounts.map((account) => {
              const name = getAccountName(account);

              const vehicles =
                account.vehicles?.length > 0
                  ? account.vehicles
                      .map(
                        (vehicle) =>
                          `${vehicle.label} / ${vehicle.license_plate}`
                      )
                      .join(", ")
                  : "No vehicles";

              return (
                <div
                  key={account.id}
                  className={selected?.id === account.id ? "selected" : ""}
                >
                  <strong>
                    <Link href={`/admin/access-accounts/${account.id}`}>
                      {account.access_id || "Pending"}
                    </Link>
                  </strong>

                  <span>
                    <Link href={`/admin/access-accounts/${account.id}`}>
                      {name}
                    </Link>
                  </span>

                  <StatusBadge
                    label={formatStatus(account.status)}
                    tone={getTone(account.status)}
                  />

                  <span>
                    {"expires_at" in account
                      ? String((account as any).expires_at || "Pending")
                      : "Pending"}
                  </span>

                  <span>—</span>
                  <span>—</span>
                  <span>{vehicles}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="account-profile-column">
        {!selected ? (
          <Card title="360° Account Overview">
            <p className="muted-text">Select an account to view details.</p>
          </Card>
        ) : (
          <>
            <Card title="360° Account Overview">
              <div className="profile-header-row">
                <div>
                  <h2>{getAccountName(selected)}</h2>
                  <p>{selected.access_id || "Access ID pending"}</p>
                </div>

                <StatusBadge
                  label={formatStatus(selected.status)}
                  tone={getTone(selected.status)}
                />
              </div>

              <div className="profile-metric-grid">
                <div>
                  <span>Account Type</span>
                  <strong>{selected.account_type}</strong>
                </div>
                <div>
                  <span>Preferred Gate</span>
                  <strong>{selected.default_gate || "—"}</strong>
                </div>
                <div>
                  <span>Organization</span>
                  <strong>{selected.organization || "—"}</strong>
                </div>
                <div>
                  <span>Vehicles</span>
                  <strong>{selected.vehicles?.length || 0} Registered</strong>
                </div>
              </div>
            </Card>

            <Card title="Contact & Vehicles">
              <div className="profile-detail-list">
                <div>
                  <span>Phone</span>
                  <strong>{selected.applicant?.phone || "—"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selected.applicant?.email || "—"}</strong>
                </div>
                <div>
                  <span>Emergency Contact</span>
                  <strong>
                    {selected.emergency_contact_name || "—"}{" "}
                    {selected.emergency_contact_phone || ""}
                  </strong>
                </div>
                <div>
                  <span>Vehicles</span>
                  <strong>
                    {selected.vehicles?.length
                      ? selected.vehicles
                          .map(
                            (vehicle) =>
                              `${vehicle.label} / ${vehicle.license_plate}`
                          )
                          .join(", ")
                      : "No vehicles"}
                  </strong>
                </div>
              </div>
            </Card>

            <Card title="Administrator Notes">
              <p className="muted-text">
                Internal notes will be connected in the next account detail
                workflow.
              </p>
            </Card>

            <Card title="Recent Timeline">
              <p className="muted-text">
                Timeline events will be shown on the account detail page.
              </p>
            </Card>

            <Card title="Quick Actions">
              <div className="quick-action-button-grid">
                <Link
                  className="button secondary"
                  href={`/admin/access-accounts/${selected.id}`}
                >
                  View Full Profile
                </Link>

                <button className="button secondary" type="button">
                  Renew
                </button>

                <button className="button secondary" type="button">
                  Send SMS
                </button>

                <button className="button secondary" type="button">
                  View Trips
                </button>

                <button className="button secondary" type="button">
                  Print Access Card
                </button>

                <button className="button danger" type="button">
                  Suspend
                </button>

                <button
                  className="button danger"
                  type="button"
                  disabled={
                    revokingAccountId === selected.id ||
                    deletingAccountId === selected.id
                  }
                  onClick={() => void revokeAccessAccount(selected)}
                >
                  {revokingAccountId === selected.id
                    ? "Revoking..."
                    : "Revoke Account"}
                </button>

                <button
                  className="button danger"
                  type="button"
                  disabled={
                    deletingAccountId === selected.id ||
                    revokingAccountId === selected.id
                  }
                  onClick={() => void deleteAccessAccount(selected)}
                >
                  {deletingAccountId === selected.id
                    ? "Deleting..."
                    : "Delete Account"}
                </button>
              </div>

              <p className="muted-text" style={{ marginTop: 12 }}>
                Revoke preserves history. Delete is permanent and requires the
                current admin password.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
