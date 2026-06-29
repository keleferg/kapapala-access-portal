"use client";

import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { useAccountTimeline } from "../../lib/hooks/useAccountTimeline";

function tone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

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

  const account = accounts.find((item) => item.id === accountId);

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
    ? `${applicant.first_name} ${applicant.last_name}`
    : "Unknown Applicant";

  return (
    <>
      <div className="page-heading">
        <p>Access Account Profile</p>
        <h2>{name}</h2>
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
                <h2>{name}</h2>
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
          </Card>

          <Card title="Emergency Contact">
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
          </Card>

          <Card title="Registered Vehicles">
            <div className="saved-item-list">
              {account.vehicles?.length ? (
                account.vehicles.map((vehicle) => (
                  <div key={vehicle.id}>
                    <strong>{vehicle.label}</strong>
                    <span>
                      {vehicle.state} {vehicle.license_plate}
                    </span>
                    {vehicle.is_default && (
                      <StatusBadge label="Primary" tone="green" />
                    )}
                  </div>
                ))
              ) : (
                <p className="muted-text">No vehicles registered.</p>
              )}
            </div>
          </Card>
        </div>

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

              <button className="button secondary" type="button">
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
            <p className="muted-text">
              Notes will be connected next. This section will store internal
              administrator notes only.
            </p>
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
                {events.map((event) => (
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