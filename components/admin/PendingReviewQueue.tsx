"use client";

import { useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";

export default function PendingReviewQueue() {
  const { accounts, loading, error, refresh } = useAccessAccounts();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingAccounts = accounts.filter(
    (account) => account.status === "pending"
  );

  async function approveAccount(accountId: string) {
    setApprovingId(accountId);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/approve`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Approval failed.");
        return;
      }

      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <Card
      title="Pending Access Account Reviews"
      className="admin-inner-card admin-queue-card"
    >
      {loading && <p className="muted-text">Loading pending applications...</p>}

      {error && (
        <div className="error-callout">
          <strong>Unable to load applications</strong>
          <p>{error}</p>
          <button className="button secondary" onClick={refresh} type="button">
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && pendingAccounts.length === 0 && (
        <div className="admin-empty-state">
          <span className="admin-empty-state__icon" aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>Account review queue is clear</strong>
            <p>No pending access account requests require attention.</p>
          </div>
        </div>
      )}

      {!loading && !error && pendingAccounts.length > 0 && (
        <div className="review-queue">
          {pendingAccounts.map((account) => {
            const applicant = account.applicant;
            const name = applicant
              ? `${applicant.first_name} ${applicant.last_name}`
              : "Unknown Applicant";

            const primaryVehicle =
              account.vehicles?.[0]?.label ||
              account.vehicles?.[0]?.license_plate ||
              "No vehicle listed";

            const isApproving = approvingId === account.id;

            return (
              <div
                className="review-card admin-review-card"
                key={account.id}
              >
                <div className="review-main">
                  <div className="review-avatar">🪪</div>

                  <div>
                    <h3>{name}</h3>
                    <p>
                      {applicant?.phone ||
                        applicant?.email ||
                        "No contact listed"}
                    </p>

                    <div className="review-meta-row">
                      <span>{account.organization || "Public Access"}</span>
                      <span>{primaryVehicle}</span>
                      <span>
                        Submitted{" "}
                        {new Date(account.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="review-actions">
                  <StatusBadge label="Pending Review" tone="yellow" />

                  <a
                    className="button secondary"
                    href={`/admin/access-accounts/${account.id}`}
                  >
                    Review
                  </a>

                  <button
                    className="button primary"
                    type="button"
                    disabled={isApproving}
                    onClick={() => approveAccount(account.id)}
                  >
                    {isApproving ? "Approving..." : "Approve"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}