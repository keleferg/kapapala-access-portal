"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { useAccountTimeline } from "../../lib/hooks/useAccountTimeline";
import { getSupabaseClient } from "../../lib/supabaseClient";
import VehicleManager from "./account/VehicleManager";
import DocumentManager from "./account/DocumentManager";

function tone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function titleCase(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

type EditProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessId: string;
  status: string;
  defaultGate: string;
  organization: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export default function AccessAccountProfile({
  accountId,
}: {
  accountId: string;
}) {
  const router = useRouter();

  const { accounts, loading, error, refresh } = useAccessAccounts();

  const {
    events,
    loading: timelineLoading,
    error: timelineError,
    refresh: refreshTimeline,
  } = useAccountTimeline(accountId);

  const account = accounts.find((item) => item.id === accountId) as any;

  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [activatingAccount, setActivatingAccount] = useState(false);
  const [suspendingAccount, setSuspendingAccount] = useState(false);
  const [renewingAccount, setRenewingAccount] = useState(false);
  const [revokingAccount, setRevokingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [editForm, setEditForm] = useState<EditProfileForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    accessId: "",
    status: "pending",
    defaultGate: "",
    organization: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    if (!account) return;

    setNotes(account.internal_notes || "");

    setEditForm({
      firstName:
        account.applicant?.first_name || account.applicant_first_name || "",
      lastName:
        account.applicant?.last_name || account.applicant_last_name || "",
      email: account.applicant?.email || account.applicant_email || "",
      phone: account.applicant?.phone || account.applicant_phone || "",
      accessId: account.access_id || "",
      status: account.status || "pending",
      defaultGate: account.default_gate || "",
      organization: account.organization || "",
      emergencyContactName: account.emergency_contact_name || "",
      emergencyContactPhone: account.emergency_contact_phone || "",
    });
  }, [account]);

  function updateEditForm(field: keyof EditProfileForm, value: string) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEditProfile() {
    if (!account) return;

    setEditForm({
      firstName:
        account.applicant?.first_name || account.applicant_first_name || "",
      lastName:
        account.applicant?.last_name || account.applicant_last_name || "",
      email: account.applicant?.email || account.applicant_email || "",
      phone: account.applicant?.phone || account.applicant_phone || "",
      accessId: account.access_id || "",
      status: account.status || "pending",
      defaultGate: account.default_gate || "",
      organization: account.organization || "",
      emergencyContactName: account.emergency_contact_name || "",
      emergencyContactPhone: account.emergency_contact_phone || "",
    });

    setEditingProfile(false);
  }

  async function saveProfile() {
    setSavingProfile(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to save account profile.");
        return;
      }

      await refresh();
      await refreshTimeline();
      setEditingProfile(false);
      alert("Account profile saved.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save account profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to save notes.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Notes saved.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function renewAccount() {
    setRenewingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/renew`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to renew account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Account renewed.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to renew account.");
    } finally {
      setRenewingAccount(false);
    }
  }

  async function suspendAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to suspend this access account?"
    );

    if (!confirmed) return;

    setSuspendingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/suspend`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to suspend account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Account suspended.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to suspend account."
      );
    } finally {
      setSuspendingAccount(false);
    }
  }

  async function activateAccount() {
    const confirmed = window.confirm(
      "Activate this access account? This will assign an Access ID and send the applicant a confirmation email."
    );

    if (!confirmed) return;

    setActivatingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/activate`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to activate account.");
        return;
      }

      await refresh();
      await refreshTimeline();

      const accessId = result.accessId || result.account?.access_id;

      alert(
        accessId
          ? `Account activated. Access ID: ${accessId}`
          : "Account activated."
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to activate account."
      );
    } finally {
      setActivatingAccount(false);
    }
  }

  async function revokeAccount() {
    if (!account) return;

    const accessId = account.access_id || "Pending";
    const firstName =
      account.applicant?.first_name || account.applicant_first_name || "";
    const lastName =
      account.applicant?.last_name || account.applicant_last_name || "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";

    const confirmed = window.confirm(
      `Revoke this access account?\n\nName: ${name}\nAccess ID: ${accessId}\n\nThis will preserve the account history but prevent the account from being treated as active.`
    );

    if (!confirmed) return;

    setRevokingAccount(true);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("access_accounts")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (error) {
        alert(error.message || "Unable to revoke account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Access account revoked.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to revoke account."
      );
    } finally {
      setRevokingAccount(false);
    }
  }

  async function deleteAccount() {
    if (!account) return;

    const accessId = account.access_id || "Pending";
    const firstName =
      account.applicant?.first_name || account.applicant_first_name || "";
    const lastName =
      account.applicant?.last_name || account.applicant_last_name || "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";

    const confirmed = window.confirm(
      `Delete this access account?\n\nName: ${name}\nAccess ID: ${accessId}\n\nThis is permanent and cannot be undone.`
    );

    if (!confirmed) return;

    const password = window.prompt(
      "Enter your admin password to confirm deletion:"
    );

    if (!password) return;

    setDeletingAccount(true);

    try {
      const supabase = getSupabaseClient() as any;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.email) {
        alert("Unable to verify the current admin user.");
        return;
      }

      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (passwordError) {
        alert("Password verification failed. Account was not deleted.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("access_accounts")
        .delete()
        .eq("id", accountId);

      if (deleteError) {
        alert(
          deleteError.message ||
            "Unable to delete access account. If this account has request history, revoke the account instead."
        );
        return;
      }

      alert("Access account deleted.");
      router.push("/admin/access-accounts");
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete access account."
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  if (loading) {
    return <p className="muted-text">Loading account profile...</p>;
  }

  if (error) {
    return (
      <Card title="Unable to Load Account">
        <p>{error}</p>
        <button className="button secondary" onClick={refresh} type="button">
          Try Again
        </button>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card title="Account Not Found">
        <p className="muted-text">This access account could not be found.</p>
        <Link className="button secondary" href="/admin/access-accounts">
          Back to Access Accounts
        </Link>
      </Card>
    );
  }

  const firstName = account.applicant?.first_name || account.applicant_first_name || "";
  const lastName = account.applicant?.last_name || account.applicant_last_name || "";
  const email = account.applicant?.email || account.applicant_email || "";
  const phone = account.applicant?.phone || account.applicant_phone || "";

  const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";
  const displayName =
    `${editForm.firstName} ${editForm.lastName}`.trim() || name;

  const accountStatus = account.status || "pending";
  const hasAccessId = Boolean(account.access_id);

  return (
    <>
      <div className="page-heading">
        <p>Access Account Profile</p>
        <h2>{displayName}</h2>
        <span>
          Full access account record, vehicles, emergency contact, and account
          status.
        </span>
      </div>

      <div className="account-management-layout">
        <div>
          <Card title="360° Account Overview">
            <div className="profile-header-row">
              <div>
                <h2>{displayName}</h2>
                <p>{account.access_id || "Access ID pending"}</p>
              </div>

              <StatusBadge
                label={titleCase(accountStatus)}
                tone={tone(accountStatus)}
              />
            </div>

            <div className="profile-metric-grid">
              <div>
                <span>Status</span>
                <strong>{titleCase(accountStatus)}</strong>
              </div>

              <div>
                <span>Access ID</span>
                <strong>{account.access_id || "Pending"}</strong>
              </div>

              <div>
                <span>Preferred Gate</span>
                <strong>{account.default_gate || "—"}</strong>
              </div>

              <div>
                <span>Vehicles</span>
                <strong>{account.vehicles?.length || 0}</strong>
              </div>
            </div>
          </Card>

          <Card title="Applicant Information">
            <div className="profile-card-actions">
              {!editingProfile ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setEditingProfile(true)}
                >
                  Edit Account Profile
                </button>
              ) : (
                <>
                  <button
                    className="button primary"
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    className="button secondary"
                    type="button"
                    onClick={cancelEditProfile}
                    disabled={savingProfile}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Name</span>
                  <strong>{name}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{email || "—"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{phone || "—"}</strong>
                </div>

                <div>
                  <span>Organization / Purpose</span>
                  <strong>{account.organization || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  First Name
                  <input
                    value={editForm.firstName}
                    onChange={(event) =>
                      updateEditForm("firstName", event.target.value)
                    }
                  />
                </label>

                <label>
                  Last Name
                  <input
                    value={editForm.lastName}
                    onChange={(event) =>
                      updateEditForm("lastName", event.target.value)
                    }
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      updateEditForm("email", event.target.value)
                    }
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={editForm.phone}
                    onChange={(event) =>
                      updateEditForm("phone", event.target.value)
                    }
                  />
                </label>

                <label>
                  Organization / Purpose
                  <input
                    value={editForm.organization}
                    onChange={(event) =>
                      updateEditForm("organization", event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </Card>

          <Card title="Access Account Details">
            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Access ID</span>
                  <strong>{account.access_id || "Pending"}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{titleCase(accountStatus)}</strong>
                </div>

                <div>
                  <span>Preferred Gate</span>
                  <strong>{account.default_gate || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  Access ID
                  <input
                    value={editForm.accessId}
                    onChange={(event) =>
                      updateEditForm("accessId", event.target.value)
                    }
                  />
                </label>

                <label>
                  Account Status
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      updateEditForm("status", event.target.value)
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                    <option value="denied">Denied</option>
                  </select>
                </label>

                <label>
                  Preferred Gate
                  <input
                    value={editForm.defaultGate}
                    onChange={(event) =>
                      updateEditForm("defaultGate", event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </Card>

          <Card title="Emergency Contact">
            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Name</span>
                  <strong>{account.emergency_contact_name || "—"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{account.emergency_contact_phone || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  Emergency Contact Name
                  <input
                    value={editForm.emergencyContactName}
                    onChange={(event) =>
                      updateEditForm(
                        "emergencyContactName",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Emergency Contact Phone
                  <input
                    value={editForm.emergencyContactPhone}
                    onChange={(event) =>
                      updateEditForm(
                        "emergencyContactPhone",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            )}
          </Card>

          <VehicleManager
            accountId={accountId}
            vehicles={account.vehicles || []}
            refresh={refresh}
            refreshTimeline={refreshTimeline}
          />
        </div>

        <DocumentManager
          accountId={accountId}
          refreshTimeline={refreshTimeline}
        />

        <div className="account-profile-column">
          <Card title="Quick Actions">
            <div className="quick-action-button-grid">
              <Link className="button secondary" href="/admin/access-accounts">
                Back to Accounts
              </Link>

              {accountStatus === "active" ? (
                <button
                  className="button danger"
                  type="button"
                  onClick={suspendAccount}
                  disabled={
                    suspendingAccount || revokingAccount || deletingAccount
                  }
                >
                  {suspendingAccount ? "Suspending..." : "Suspend Account"}
                </button>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  onClick={activateAccount}
                  disabled={
                    activatingAccount || revokingAccount || deletingAccount
                  }
                >
                  {activatingAccount ? "Activating..." : "Activate Account"}
                </button>
              )}

              <button
                className="button secondary"
                type="button"
                onClick={renewAccount}
                disabled={
                  renewingAccount ||
                  !hasAccessId ||
                  revokingAccount ||
                  deletingAccount
                }
                title={
                  hasAccessId
                    ? "Renew this account"
                    : "Activate the account before renewing"
                }
              >
                {renewingAccount ? "Renewing..." : "Renew"}
              </button>

              <button className="button secondary" type="button">
                Send SMS
              </button>

              <button className="button secondary" type="button">
                Print Access Card
              </button>

              <button
                className="button danger"
                type="button"
                onClick={revokeAccount}
                disabled={revokingAccount || deletingAccount}
              >
                {revokingAccount ? "Revoking..." : "Revoke Account"}
              </button>

              <button
                className="button danger"
                type="button"
                onClick={deleteAccount}
                disabled={deletingAccount || revokingAccount}
              >
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>

            <p className="muted-text" style={{ marginTop: 12 }}>
              Revoke preserves history. Delete is permanent and requires the
              current admin password.
            </p>
          </Card>

          <Card title="Administrator Notes">
            <div className="mobile-form-stack">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Enter internal administrator notes..."
                rows={6}
              />

              <button
                className="button primary"
                type="button"
                onClick={saveNotes}
                disabled={savingNotes || deletingAccount || revokingAccount}
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </Card>

          <Card title="Timeline">
            {timelineLoading && (
              <p className="muted-text">Loading timeline events...</p>
            )}

            {timelineError && (
              <div className="error-callout">
                <strong>Unable to load timeline</strong>
                <p>{timelineError}</p>
              </div>
            )}

            {!timelineLoading && !timelineError && events.length === 0 && (
              <p className="muted-text">No timeline events yet.</p>
            )}

            {!timelineLoading && !timelineError && events.length > 0 && (
              <div className="timeline-list">
                {events.map((event: any) => (
                  <div key={event.id}>
                    <span>{formatDateTime(event.created_at)}</span>
                    <strong>{event.event_title}</strong>
                    {event.event_body && <p>{event.event_body}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}