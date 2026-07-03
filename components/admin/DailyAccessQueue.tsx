"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | "cancelled" | string;

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

export default function DailyAccessQueue() {
  const [requests, setRequests] = useState<DailyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();
    const today = todayDateString();
    const tomorrow = tomorrowDateString();

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
          profiles!access_accounts_profile_id_fkey (
            first_name,
            last_name
          )
        ),
        gates (
          name
        )
      `)
      .gte("request_date", today)
      .lte("request_date", tomorrow)
      .order("request_date", { ascending: true })
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

  return (
    <Card title="Daily Access Request Queue">
      <div className="admin-toolbar">
        <div>
          <strong>Daily access requests</strong>
          <p>Today and tomorrow&apos;s daily access requests from Supabase.</p>
        </div>

        <button className="button secondary" type="button" onClick={loadRequests}>
          Refresh
        </button>
      </div>

      {loading && <p className="muted-text">Loading daily access requests...</p>}

      {errorMessage && (
        <div className="error-callout">
          <strong>Unable to load requests</strong>
          <p>{errorMessage}</p>
        </div>
      )}

      {!loading && !errorMessage && requests.length === 0 && (
        <p className="muted-text">
          No daily access requests for today or tomorrow.
        </p>
      )}

      {!loading && !errorMessage && requests.length > 0 && (
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

          {requests.map((request) => {
            const requesterName = getRequesterName(request);
            const accessId = request.access_accounts?.access_id || "Pending";
            const partySize = request.party_size ?? 0;

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
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}