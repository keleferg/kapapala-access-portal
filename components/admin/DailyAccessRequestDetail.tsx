"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | string;

type DailyAccessRequest = {
  id: string;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  user_comments: string | null;
  status: RequestStatus;
  created_at: string;

  access_accounts: {
    id: string;
    access_id: string | null;
    profiles: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;

  gates: {
    name: string | null;
  } | null;
};

type DailyAccessRequestDetailProps = {
  requestId: string;
};

function getRequesterName(request: DailyAccessRequest) {
  const profile = request.access_accounts?.profiles;

  const firstName = profile?.first_name?.trim() ?? "";
  const lastName = profile?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Unknown User";
}

function formatStatus(status: RequestStatus) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: RequestStatus): "green" | "yellow" | "red" {
  if (status === "approved") return "green";
  if (status === "denied") return "red";
  return "yellow";
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Unknown";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) return "Unknown";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="request-detail-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="request-detail-section">
      <h3>{title}</h3>
      <div className="request-detail-grid">{children}</div>
    </section>
  );
}

export default function DailyAccessRequestDetail({
  requestId,
}: DailyAccessRequestDetailProps) {
  const [request, setRequest] = useState<DailyAccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<RequestStatus | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function loadRequest() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("daily_access_requests")
      .select(`
        id,
        request_date,
        purpose,
        party_size,
        vehicle_summary,
        user_comments,
        status,
        created_at,
        access_accounts (
          id,
          access_id,
          profiles!access_accounts_profile_id_fkey (
            first_name,
            last_name
          )
        ),
        gates (
          name
        )
      `)
      .eq("id", requestId)
      .single();

    if (error) {
      console.error("Unable to load daily access request:", error);
      setRequest(null);
      setErrorMessage(error.message || "Unable to load this request.");
      setLoading(false);
      return;
    }

    setRequest(data as DailyAccessRequest);
    setLoading(false);
  }

  async function updateStatus(status: "approved" | "denied") {
    if (!request) return;

    const confirmed = window.confirm(
      status === "approved"
        ? "Approve this access request?"
        : "Deny this access request?"
    );

    if (!confirmed) return;

    setUpdatingStatus(status);

    try {
      const response = await fetch(
        `/api/admin/daily-access-requests/${request.id}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        alert(result?.error || "Unable to update this request.");
        return;
      }

      await loadRequest();
    } catch (error) {
      console.error("Unable to update request status:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update this request."
      );
    } finally {
      setUpdatingStatus(null);
    }
  }

  if (loading) {
    return (
      <Card title="Loading Request...">
        <p className="text-sm text-gray-600">Please wait...</p>
      </Card>
    );
  }

  if (errorMessage || !request) {
    return (
      <Card title="Unable to Load Request">
        <div className="request-detail-empty">
          <p>{errorMessage || "This request could not be loaded."}</p>

          <Link className="button secondary" href="/admin/requests">
            Back to Requests
          </Link>
        </div>
      </Card>
    );
  }

  const requesterName = getRequesterName(request);
  const partySize = request.party_size ?? 0;
  const accessAccount = request.access_accounts;
  const isPending = request.status === "pending";

  return (
    <div className="request-detail-page">
      <Link className="request-detail-back-link" href="/admin/requests">
        ← Back to Requests
      </Link>

      <Card>
        <div className="request-detail-header">
          <div>
            <p className="eyebrow">Daily Access Request</p>

            <h1>{requesterName}</h1>

            <p>
              Requested access for{" "}
              <strong>{formatDate(request.request_date)}</strong>
            </p>
          </div>

          <StatusBadge
            label={formatStatus(request.status)}
            tone={statusTone(request.status)}
          />
        </div>

        <div className="request-detail-body">
          <DetailSection title="Requester Information">
            <DetailItem label="Requester" value={requesterName} />
            <DetailItem
              label="Access ID"
              value={accessAccount?.access_id || "Pending"}
            />
            <DetailItem
              label="Submitted"
              value={formatDateTime(request.created_at)}
            />
            <DetailItem label="Status" value={formatStatus(request.status)} />
          </DetailSection>

          <DetailSection title="Access Details">
            <DetailItem
              label="Request Date"
              value={formatDate(request.request_date)}
            />
            <DetailItem label="Gate" value={request.gates?.name} />
            <DetailItem label="Purpose" value={request.purpose} />
            <DetailItem
              label="Party Size"
              value={`${partySize} Person${partySize !== 1 ? "s" : ""}`}
            />
          </DetailSection>

          <DetailSection title="Vehicle Information">
            <DetailItem
              label="Vehicle"
              value={request.vehicle_summary || "No vehicle listed"}
            />
          </DetailSection>

          <DetailSection title="Applicant Comments">
            <DetailItem
              label="Comments"
              value={request.user_comments?.trim() || "No comments provided"}
            />
          </DetailSection>
        </div>

        <div className="request-detail-actions">
          <Link
            className="button secondary"
            href={`/admin/access-accounts/${accessAccount?.id}`}
          >
            View Full Profile
          </Link>
          {isPending ? (
            <>
              <button
                className="button primary"
                type="button"
                onClick={() => updateStatus("approved")}
                disabled={updatingStatus !== null}
              >
                {updatingStatus === "approved"
                  ? "Approving..."
                  : "Approve Request"}
              </button>

              <button
                className="button danger"
                type="button"
                onClick={() => updateStatus("denied")}
                disabled={updatingStatus !== null}
              >
                {updatingStatus === "denied" ? "Denying..." : "Deny Request"}
              </button>
            </>
          ) : (
            <p className="request-detail-status-note">
              This request is already{" "}
              {formatStatus(request.status).toLowerCase()}.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}