"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { getSupabaseClient } from "../../lib/supabaseClient";

type AppRole = "user" | "admin" | "super_user";

type AccountStatus = "active" | "pending" | "expired" | "suspended" | "revoked";

type Vehicle = {
  label?: string | null;
  license_plate?: string | null;
};

type Applicant = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AccessAccount = {
  id: string;
  access_id?: string | null;
  profile_id?: string | null;
  status: AccountStatus | string;
  app_role?: AppRole | null;
  account_type?: string | null;
  default_gate?: string | null;
  organization?: string | null;
  expires_at?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  applicant_first_name?: string | null;
  applicant_last_name?: string | null;
  applicant_email?: string | null;
  email?: string | null;
  applicant?: Applicant | null;
  vehicles?: Vehicle[] | null;
};

type NewUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  defaultGate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleLabel: string;
  licensePlate: string;
  vehicleState: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
};

type RequestCounters = {
  requests_90: number;
  entries_90: number;
  requests_365: number;
  entries_365: number;
  requests_lifetime: number;
  entries_lifetime: number;
};

type AccessAccountManagementProps = {
  accountId?: string;
};

const emptyNewUserForm: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  organization: "",
  defaultGate: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  vehicleLabel: "",
  licensePlate: "",
  vehicleState: "HI",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
};

const emptyRequestCounters: RequestCounters = {
  requests_90: 0,
  entries_90: 0,
  requests_365: 0,
  entries_365: 0,
  requests_lifetime: 0,
  entries_lifetime: 0,
};

function getTone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function formatStatus(status: string) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRole(role?: AppRole | null) {
  if (role === "super_user") return "Super User";
  if (role === "admin") return "Admin";
  return "User";
}

function getAccountName(account: AccessAccount) {
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

function getAccountEmail(account: AccessAccount) {
  return (
    account.applicant?.email ||
    account.applicant_email ||
    account.email ||
    ""
  );
}

function getVehicleSummary(account: AccessAccount) {
  if (!account.vehicles?.length) return "No vehicles";

  return account.vehicles
    .map((vehicle) => {
      const label = vehicle.label || "Vehicle";
      const plate = vehicle.license_plate || "No plate";
      return `${label} / ${plate}`;
    })
    .join(", ");
}

function formatRequestCounter(entries: number, requests: number) {
  return `${entries}/${requests}`;
}

export default function AccessAccountManagement({
  accountId,
}: AccessAccountManagementProps) {
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );

  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUserForm);

  const [activatingAccountId, setActivatingAccountId] = useState<string | null>(
    null
  );
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null
  );
  const [revokingAccountId, setRevokingAccountId] = useState<string | null>(
    null
  );

  const [requestCounters, setRequestCounters] =
    useState<RequestCounters>(emptyRequestCounters);
  const [loadingRequestCounters, setLoadingRequestCounters] = useState(false);
  const [requestCounterError, setRequestCounterError] = useState<string | null>(
    null
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const applicant = account.applicant;

      const vehicleText =
        account.vehicles
          ?.map(
            (vehicle) =>
              `${vehicle.label || ""} ${vehicle.license_plate || ""}`
          )
          .join(" ")
          .toLowerCase() || "";

      const searchableText = [
        account.access_id,
        account.status,
        account.app_role,
        account.organization,
        account.applicant_first_name,
        account.applicant_last_name,
        account.applicant_email,
        account.email,
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

  const selected =
    accounts.find((account) => account.id === accountId) ||
    filteredAccounts.find((account) => account.id === selectedAccountId) ||
    filteredAccounts[0] ||
    accounts[0] ||
    null;

  useEffect(() => {
    let cancelled = false;

    async function loadRequestCounters() {
      if (!selected?.id) {
        setRequestCounters(emptyRequestCounters);
        setRequestCounterError(null);
        return;
      }

      setLoadingRequestCounters(true);
      setRequestCounterError(null);

      try {
        const supabase = getSupabaseClient() as any;

        const { data, error } = await supabase.rpc(
          "get_access_account_request_counters",
          {
            p_access_account_id: selected.id,
          }
        );

        if (error) {
          throw error;
        }

        const row = Array.isArray(data) ? data[0] : data;

        if (!cancelled) {
          setRequestCounters({
            requests_90: Number(row?.requests_90 ?? 0),
            entries_90: Number(row?.entries_90 ?? 0),
            requests_365: Number(row?.requests_365 ?? 0),
            entries_365: Number(row?.entries_365 ?? 0),
            requests_lifetime: Number(row?.requests_lifetime ?? 0),
            entries_lifetime: Number(row?.entries_lifetime ?? 0),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRequestCounters(emptyRequestCounters);
          setRequestCounterError(
            error instanceof Error
              ? error.message
              : "Unable to load request counters."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRequestCounters(false);
        }
      }
    }

    void loadRequestCounters();

    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const activeCount = accounts.filter(
    (account) => account.status === "active"
  ).length;

  const pendingCount = accounts.filter(
    (account) => account.status === "pending"
  ).length;

  const suspendedCount = accounts.filter(
    (account) => account.status === "suspended"
  ).length;

  const adminCount = accounts.filter(
    (account) => account.app_role === "admin"
  ).length;

  const superUserCount = accounts.filter(
    (account) => account.app_role === "super_user"
  ).length;

  function updateNewUserField(field: keyof NewUserForm, value: string) {
    setNewUser((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refreshAccounts() {
    await refresh();

    if (selected?.id) {
      setSelectedAccountId(selected.id);
    }
  }

  async function addUserAccount() {
    setActionError(null);
    setActionSuccess(null);

    if (!newUser.firstName.trim() || !newUser.lastName.trim()) {
      setActionError("First name and last name are required.");
      return;
    }

    if (!newUser.email.trim()) {
      setActionError("Email is required.");
      return;
    }

    const confirmed = window.confirm(
      `Create this user account?\n\nName: ${newUser.firstName.trim()} ${newUser.lastName.trim()}\nEmail: ${newUser.email.trim()}\n\nThis will bypass the public application workflow, email notifications, and photo ID upload requirement.`
    );

    if (!confirmed) return;

    setAddingUser(true);

    try {
      const vehicles = newUser.licensePlate.trim()
        ? [
            {
              label: newUser.vehicleLabel.trim() || "Primary Vehicle",
              licensePlate: newUser.licensePlate.trim(),
              state: newUser.vehicleState.trim() || "HI",
              make: newUser.vehicleMake.trim() || undefined,
              model: newUser.vehicleModel.trim() || undefined,
              color: newUser.vehicleColor.trim() || undefined,
              isDefault: true,
            },
          ]
        : [];

      const response = await fetch("/api/access-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: newUser.firstName.trim(),
          lastName: newUser.lastName.trim(),
          email: newUser.email.trim(),
          phone: newUser.phone.trim() || undefined,
          organization: newUser.organization.trim() || undefined,
          emergencyContactName:
            newUser.emergencyContactName.trim() || undefined,
          emergencyContactPhone:
            newUser.emergencyContactPhone.trim() || undefined,
          defaultGate: newUser.defaultGate || undefined,
          vehicles,
          adminCreated: true,
          bypassPhotoId: true,
          bypassNotifications: true,
          status: "active",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setActionError(result.error || "Unable to create user account.");
        return;
      }

      setShowAddUserForm(false);
      setNewUser(emptyNewUserForm);
      setActionSuccess("User account created.");
      await refreshAccounts();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to create user account."
      );
    } finally {
      setAddingUser(false);
    }
  }

  async function activateAccessAccount(account: AccessAccount) {
    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";
    const email = getAccountEmail(account) || "No email on file";

    setActionError(null);
    setActionSuccess(null);

    const confirmed = window.confirm(
      `Approve and activate this access account?\n\nName: ${accountName}\nAccess ID: ${accessId}\nEmail: ${email}\n\nThis will activate the account and send the welcome email if an email address is on file.`
    );

    if (!confirmed) return;

    setActivatingAccountId(account.id);

    try {
      const response = await fetch(`/api/access-accounts/${account.id}/activate`, {
        method: "POST",
      });

      const result = await response.json();

      console.log("Activation result:", result);

      if (!response.ok || !result.success) {
        setActionError(result.error || "Unable to activate access account.");
        console.error("Activation failed:", result);
        return;
      }

      if (!result.emailPrepared) {
        setActionSuccess("Account activated.");
        setActionError(
          "Account activated, but no welcome email was prepared because this account does not have an email address on file."
        );
      } else if (!result.emailSent) {
        setActionSuccess("Account activated.");
        setActionError(
          result.emailError
            ? `Account activated, but email was not sent: ${result.emailError}`
            : "Account activated, but email was not sent. Check Resend configuration and Netlify environment variables."
        );
      } else {
        setActionSuccess("Account activated and welcome email sent.");
      }

      await refreshAccounts();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to activate access account."
      );
    } finally {
      setActivatingAccountId(null);
    }
  }

  async function revokeAccessAccount(account: AccessAccount) {
    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";

    setActionError(null);
    setActionSuccess(null);

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

      setActionSuccess("Account revoked.");
      await refreshAccounts();
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

  async function deleteAccessAccount(account: AccessAccount) {
    const accountName = getAccountName(account);
    const accessId = account.access_id || "Pending";

    setActionError(null);
    setActionSuccess(null);

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

      setActionSuccess("Account deleted.");
      setSelectedAccountId(null);
      await refreshAccounts();
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
    <div className="access-account-management">
      <section className="access-accounts-summary-panel">
        <Card title="Access Accounts Summary">
          <div className="profile-metric-grid">
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
              <span>Admins</span>
              <strong>{adminCount}</strong>
            </div>

            <div>
              <span>Super Users</span>
              <strong>{superUserCount}</strong>
            </div>

            <div>
              <span>Total</span>
              <strong>{accounts.length}</strong>
            </div>
          </div>
        </Card>
      </section>

      <section className="access-accounts-workspace">
        <Card title="Access Accounts">
          <div className="account-toolbar">
            <input
              aria-label="Search access accounts"
              placeholder="Search by name, Access ID, phone, email, role, or license plate"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <button
              className="button primary"
              type="button"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setShowAddUserForm(true);
              }}
            >
              Add User
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => void refreshAccounts()}
            >
              Refresh
            </button>
          </div>

          {showAddUserForm && (
            <div className="admin-add-user-panel">
              <div className="admin-add-user-heading">
                <strong>Add User Account</strong>
                <p className="muted-text">
                  Creates an active user account directly. This bypasses public
                  email notifications and photo ID upload requirements.
                </p>
              </div>

              <div className="admin-add-user-grid">
                <input
                  placeholder="First name"
                  value={newUser.firstName}
                  onChange={(event) =>
                    updateNewUserField("firstName", event.target.value)
                  }
                />

                <input
                  placeholder="Last name"
                  value={newUser.lastName}
                  onChange={(event) =>
                    updateNewUserField("lastName", event.target.value)
                  }
                />

                <input
                  placeholder="Email"
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    updateNewUserField("email", event.target.value)
                  }
                />

                <input
                  placeholder="Phone"
                  value={newUser.phone}
                  onChange={(event) =>
                    updateNewUserField("phone", event.target.value)
                  }
                />

                <input
                  placeholder="Organization"
                  value={newUser.organization}
                  onChange={(event) =>
                    updateNewUserField("organization", event.target.value)
                  }
                />

                <select
                  value={newUser.defaultGate}
                  onChange={(event) =>
                    updateNewUserField("defaultGate", event.target.value)
                  }
                >
                  <option value="">Default gate</option>
                  <option value="Wood Valley">Wood Valley</option>
                  <option value="Honanui">Honanui</option>
                  <option value="ʻĀinapō">ʻĀinapō</option>
                </select>

                <input
                  placeholder="Emergency contact name"
                  value={newUser.emergencyContactName}
                  onChange={(event) =>
                    updateNewUserField(
                      "emergencyContactName",
                      event.target.value
                    )
                  }
                />

                <input
                  placeholder="Emergency contact phone"
                  value={newUser.emergencyContactPhone}
                  onChange={(event) =>
                    updateNewUserField(
                      "emergencyContactPhone",
                      event.target.value
                    )
                  }
                />

                <input
                  placeholder="Vehicle label"
                  value={newUser.vehicleLabel}
                  onChange={(event) =>
                    updateNewUserField("vehicleLabel", event.target.value)
                  }
                />

                <input
                  placeholder="License plate"
                  value={newUser.licensePlate}
                  onChange={(event) =>
                    updateNewUserField("licensePlate", event.target.value)
                  }
                />

                <input
                  placeholder="State"
                  value={newUser.vehicleState}
                  onChange={(event) =>
                    updateNewUserField("vehicleState", event.target.value)
                  }
                />

                <input
                  placeholder="Make"
                  value={newUser.vehicleMake}
                  onChange={(event) =>
                    updateNewUserField("vehicleMake", event.target.value)
                  }
                />

                <input
                  placeholder="Model"
                  value={newUser.vehicleModel}
                  onChange={(event) =>
                    updateNewUserField("vehicleModel", event.target.value)
                  }
                />

                <input
                  placeholder="Color"
                  value={newUser.vehicleColor}
                  onChange={(event) =>
                    updateNewUserField("vehicleColor", event.target.value)
                  }
                />
              </div>

              <div className="admin-add-user-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={addingUser}
                  onClick={() => void addUserAccount()}
                >
                  {addingUser ? "Creating..." : "Create User"}
                </button>

                <button
                  className="button secondary"
                  type="button"
                  disabled={addingUser}
                  onClick={() => {
                    setShowAddUserForm(false);
                    setActionError(null);
                    setActionSuccess(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

          {actionSuccess && (
            <div className="success-callout">
              <strong>Action completed</strong>
              <p>{actionSuccess}</p>
            </div>
          )}

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
            <div className="access-account-name-list">
              {filteredAccounts.map((account) => {
                const name = getAccountName(account);
                const vehicles = getVehicleSummary(account);
                const isSelected = selected?.id === account.id;

                return (
                  <button
                    key={account.id}
                    type="button"
                    className={`access-account-name-row ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <div className="access-account-name-main">
                      <strong>{name}</strong>
                      <span>{account.access_id || "Access ID pending"}</span>
                    </div>

                    <div className="access-account-status-cell">
                      <StatusBadge
                        label={formatStatus(account.status)}
                        tone={getTone(account.status)}
                      />
                    </div>

                    <small>{formatRole(account.app_role)}</small>
                    <small>{vehicles}</small>
                  </button>
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
                    <strong>{selected.account_type || "—"}</strong>
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

              <Card title="Access History Counters">
                <div className="profile-metric-grid">
                  <div>
                    <span>Entries / Requests 90 Days</span>
                    <strong>
                      {loadingRequestCounters
                        ? "Loading..."
                        : formatRequestCounter(
                            requestCounters.entries_90,
                            requestCounters.requests_90
                          )}
                    </strong>
                  </div>

                  <div>
                    <span>Entries / Requests 365 Days</span>
                    <strong>
                      {loadingRequestCounters
                        ? "Loading..."
                        : formatRequestCounter(
                            requestCounters.entries_365,
                            requestCounters.requests_365
                          )}
                    </strong>
                  </div>

                  <div>
                    <span>Entries / Requests Lifetime</span>
                    <strong>
                      {loadingRequestCounters
                        ? "Loading..."
                        : formatRequestCounter(
                            requestCounters.entries_lifetime,
                            requestCounters.requests_lifetime
                          )}
                    </strong>
                  </div>
                </div>

                <p className="muted-text" style={{ marginTop: 12 }}>
                  Format is entries / requests. Example: 12/20 means 12
                  confirmed entries out of 20 access requests.
                </p>

                {requestCounterError && (
                  <p className="muted-text" style={{ marginTop: 12 }}>
                    Request counters could not be loaded: {requestCounterError}
                  </p>
                )}
              </Card>

              <Card title="Contact & Vehicles">
                <div className="profile-detail-list">
                  <div>
                    <span>Phone</span>
                    <strong>{selected.applicant?.phone || "—"}</strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>{getAccountEmail(selected) || "—"}</strong>
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
                    <strong>{getVehicleSummary(selected)}</strong>
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
                  {selected.status !== "active" && (
                    <button
                      className="button primary"
                      type="button"
                      disabled={activatingAccountId === selected.id}
                      onClick={() => void activateAccessAccount(selected)}
                    >
                      {activatingAccountId === selected.id
                        ? "Activating..."
                        : "Approve / Activate"}
                    </button>
                  )}

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

                  <Link
                    className="button secondary"
                    href={`/admin/access-accounts/${selected.id}/trips`}
                  >
                    View Trips
                  </Link>

                  <button className="button danger" type="button">
                    Suspend
                  </button>

                  <button
                    className="button danger"
                    type="button"
                    disabled={
                      revokingAccountId === selected.id ||
                      deletingAccountId === selected.id ||
                      activatingAccountId === selected.id
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
                      revokingAccountId === selected.id ||
                      activatingAccountId === selected.id
                    }
                    onClick={() => void deleteAccessAccount(selected)}
                  >
                    {deletingAccountId === selected.id
                      ? "Deleting..."
                      : "Delete Account"}
                  </button>
                </div>

                <p className="muted-text" style={{ marginTop: 12 }}>
                  Approve / Activate sends the welcome email. Revoke preserves
                  history. Delete is permanent and requires the current admin
                  password.
                </p>
              </Card>
            </>
          )}
        </div>
      </section>
    </div>
  );
}