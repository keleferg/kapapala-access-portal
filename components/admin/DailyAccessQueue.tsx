"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | "cancelled" | string;
type RequestTab = "today" | "future" | "past";

type DailyAccessRequest = {
  id: string;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  status: RequestStatus;
  created_at: string;

  access_accounts: {
    access_id: string | null;
    applicant_first_name?: string | null;
    applicant_last_name?: string | null;
    profiles: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;

  gates: {
    name: string | null;
  } | null;
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowDateString(): string {
  const today = todayDateString();
  const tomorrowDate = new Date(`${today}T00:00:00`);

  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const year = tomorrowDate.getFullYear();
  const month = String(tomorrowDate.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrowDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRequesterName(request: DailyAccessRequest) {
  const profile = request.access_accounts?.profiles;

  const profileFirstName = profile?.first_name?.trim() ?? "";
  const profileLastName = profile?.last_name?.trim() ?? "";
  const profileFullName = `${profileFirstName} ${profileLastName}`.trim();

  if (profileFullName) return profileFullName;

  const applicantFirstName =
    request.access_accounts?.applicant_first_name?.trim() ?? "";
  const applicantLastName =
    request.access_accounts?.applicant_last_name?.trim() ?? "";
  const applicantFullName = `${applicantFirstName} ${applicantLastName}`.trim();

  return applicantFullName || "Unknown User";
}

function formatStatus(status: RequestStatus) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: RequestStatus): "green" | "yellow" | "red" {
  if (status === "approved") return "green";
  if (status === "denied" || status === "cancelled") return "red";
  return "yellow";
}

function formatDateLabel(dateValue: string) {
  const today = todayDateString();
  const tomorrow = tomorrowDateString();

  if (dateValue === today) return "Today";
  if (dateValue === tomorrow) return "Tomorrow";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tabLabel(tab: RequestTab) {
  if (tab === "today") return "Today";
  if (tab === "future") return "Future";
  return "Past";
}

export default function DailyAccessQueue() {
  const [requests, setRequests] = useState<DailyAccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<RequestTab>("today");
  const [loading, setLoading] = useState(true);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  const today = todayDateString();

  const todayRequests = useMemo(() => {
    return requests
      .filter((request) => request.request_date === today)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [requests, today]);

  const futureRequests = useMemo(() => {
    return requests
      .filter((request) => request.request_date > today)
      .sort((a, b) => {
        const dateCompare = a.request_date.localeCompare(b.request_date);
        if (dateCompare !== 0) return dateCompare;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [requests, today]);

  const pastRequests = useMemo(() => {
    return requests
      .filter((request) => request.request_date < today)
      .sort((a, b) => {
        const dateCompare = b.request_date.localeCompare(a.request_date);
        if (dateCompare !== 0) return dateCompare;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [requests, today]);

  const filteredRequests = useMemo(() => {
    if (activeTab === "today") return todayRequests;
    if (activeTab === "future") return futureRequests;
    return pastRequests;
  }, [activeTab, todayRequests, futureRequests, pastRequests]);

  async function loadRequests() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("daily_access_requests")
      .select(`
        id,
        request_date,
        purpose,
        party_size,
        vehicle_summary,
        status,
        created_at,
        access_accounts (
          access_id,
          applicant_first_name,
          applicant_last_name,
          profiles!access_accounts_profile_id_fkey (
            first_name,
            last_name
          )
        ),
        gates (
          name
        )
      `)
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load daily access requests:", error);
      setErrorMessage(error.message || "Unable to load daily access requests.");
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests((data || []) as DailyAccessRequest[]);
    setLoading(false);
  }

  async function deleteRequest(request: DailyAccessRequest) {
    const requesterName = getRequesterName(request);
    const accessId = request.access_accounts?.access_id || "Pending";
    const gateName = request.gates?.name || "—";

    const confirmed = window.confirm(
      `Delete this daily access request?\n\nRequester: ${requesterName}\nAccess ID: ${accessId}\nGate: ${gateName}\nDate: ${request.request_date}\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingRequestId(request.id);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("daily_access_requests")
      .delete()
      .eq("id", request.id);

    if (error) {
      console.error("Unable to delete daily access request:", error);
      setErrorMessage(error.message || "Unable to delete daily access request.");
      setDeletingRequestId(null);
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
    );
    setDeletingRequestId(null);
  }

  return (
    <Card title="Daily Access Request Queue">
      <div className="admin-toolbar">
        <div>
          <strong>Daily access requests</strong>
          <p>Review today&apos;s, future, and past daily access requests.</p>
        </div>

        <button className="button secondary" type="button" onClick={loadRequests}>
          Refresh
        </button>
      </div>

      <div className="admin-toolbar" style={{ justifyContent: "flex-start" }}>
        {(["today", "future", "past"] as RequestTab[]).map((tab) => {
          const count =
            tab === "today"
              ? todayRequests.length
              : tab === "future"
                ? futureRequests.length
                : pastRequests.length;

          return (
            <button
              key={tab}
              type="button"
              className={`button ${activeTab === tab ? "" : "secondary"}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabel(tab)} ({count})
            </button>
          );
        })}
      </div>

      {loading && <p className="muted-text">Loading daily access requests...</p>}

      {errorMessage && (
        <div className="error-callout">
          <strong>Unable to load requests</strong>
          <p>{errorMessage}</p>
        </div>
      )}

      {!loading && !errorMessage && filteredRequests.length === 0 && (
        <p className="muted-text">
          No {tabLabel(activeTab).toLowerCase()} daily access requests.
        </p>
      )}

      {!loading && !errorMessage && filteredRequests.length > 0 && (
        <div className="compact-request-table">
          <div className="compact-request-header">
            <span>Requester</span>
            <span>Access ID</span>
            <span>Gate</span>
            <span>Date</span>
            <span>Purpose</span>
            <span>Party</span>
            <span>Vehicle</span>
            <span>Status</span>
            <span></span>
          </div>

          {filteredRequests.map((request) => {
            const requesterName = getRequesterName(request);
            const accessId = request.access_accounts?.access_id || "Pending";
            const partySize = request.party_size ?? 0;
            const isDeleting = deletingRequestId === request.id;

            return (
              <div className="compact-request-row" key={request.id}>
                <span className="compact-request-name">{requesterName}</span>
                <span>{accessId}</span>
                <span>{request.gates?.name || "—"}</span>
                <span>{formatDateLabel(request.request_date)}</span>
                <span>{request.purpose || "—"}</span>
                <span>{partySize}</span>
                <span>{request.vehicle_summary || "—"}</span>
                <span>
                  <StatusBadge
                    label={formatStatus(request.status)}
                    tone={statusTone(request.status)}
                  />
                </span>
                <span className="compact-request-actions">
                  <Link
                    className="button secondary"
                    href={`/admin/requests/${request.id}`}
                  >
                    View
                  </Link>

                  <button
                    className="button secondary"
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void deleteRequest(request)}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}