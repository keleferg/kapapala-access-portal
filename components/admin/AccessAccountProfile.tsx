"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { useAccountTimeline } from "../../lib/hooks/useAccountTimeline";
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
    if (account) {
      setNotes(account.internal_notes || "");

      setEditForm({
        firstName: account.applicant?.first_name || "",
        lastName: account.applicant?.last_name || "",
        email: account.applicant?.email || "",
        phone: account.applicant?.phone || "",
        accessId: account.access_id || "",
        status: account.status || "pending",
        defaultGate: account.default_gate || "",
        organization: account.organization || "",
        emergencyContactName: account.emergency_contact_name || "",
        emergencyContactPhone: account.emergency_contact_phone || "",
      });
    }
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
      firstName: account.applicant?.first_name || "",
      lastName: account.applicant?.last_name || "",
      email: account.applicant?.email || "",
      phone: account.applicant?.phone || "",
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
    }
  }

  async function suspendAccount() {
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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to suspend account.");
    }
  }

  async function reactivateAccount() {
    try {
      const response = await fetch(`/api/access-accounts/${accountId}/reactivate`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to reactivate account.");
        return;
      }

      await refresh();
      await refreshTimeline();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to reactivate account.");
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

  const applicant = account.applicant;
  const name = applicant
    ? `${applicant.first_name || ""} ${applicant.last_name || ""}`.trim()
    : "Unknown Applicant";

  const displayName =
    `${editForm.firstName} ${editForm.lastName}`.trim() || name;

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
                label={titleCase(account.status)}
                tone={tone(account.status)}
              />
            </div>

            <div className="profile-metric-grid">
              <div>
                <span>Status</span>
                <strong>{titleCase(account.status)}</strong>
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
                  <strong>{applicant?.email || "—"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{applicant?.phone || "—"}</strong>
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
                  <strong>{titleCase(account.status)}</strong>
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

              {account.status === "active" ? (
                <button
                  className="button danger"
                  type="button"
                  onClick={suspendAccount}
                >
                  Suspend Account
                </button>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  onClick={reactivateAccount}
                >
                  Reactivate Account
                </button>
              )}

              <button className="button secondary" type="button" onClick={renewAccount}>
                Renew
              </button>

              <button className="button secondary" type="button">
                Send SMS
              </button>

              <button className="button secondary" type="button">
                Print Access Card
              </button>
            </div>
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
                disabled={savingNotes}
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