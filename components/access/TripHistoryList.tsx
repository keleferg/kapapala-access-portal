"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | "cancelled" | string;

type AccessRequest = {
  id: string;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  status: RequestStatus;
  pending_reason: string | null;
  created_at: string;

  gates: {
    name: string | null;
  } | null;
};

const HAWAII_TIME_ZONE = "Pacific/Honolulu";

function getTodayDateKeyInHawaii() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function formatRequestDate(dateValue: string | null) {
  if (!dateValue) return "Unknown Date";

  const dateOnly = dateValue.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Unknown Date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) return "Unknown Date";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown Date";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
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

function sortRequestsNewestToOldest(requests: AccessRequest[]) {
  return [...requests].sort((a, b) => {
    const requestDateCompare = b.request_date.localeCompare(a.request_date);

    if (requestDateCompare !== 0) {
      return requestDateCompare;
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

function TripHistoryCard({ request }: { request: AccessRequest }) {
  const partySize = request.party_size ?? 0;

  return (
    <Card>
      <div className="review-card">
        <div className="review-main">
          <div className="review-avatar" aria-hidden="true">
            📜
          </div>

          <div>
            <h3>{formatRequestDate(request.request_date)}</h3>

            <p>
              {request.gates?.name || "Unknown Gate"} •{" "}
              {request.purpose || "No purpose listed"}
            </p>

            <div className="review-meta-row">
              <span>
                {partySize} Person{partySize !== 1 ? "s" : ""}
              </span>

              <span>{request.vehicle_summary || "No vehicle listed"}</span>

              <span>Submitted {formatDateTime(request.created_at)}</span>
            </div>

            {request.status === "pending" && request.pending_reason && (
              <div className="pending-reason">
                <strong>Pending reason:</strong> {request.pending_reason}
              </div>
            )}
          </div>
        </div>

        <div className="review-actions">
          <StatusBadge
            label={formatStatus(request.status)}
            tone={statusTone(request.status)}
          />
        </div>
      </div>
    </Card>
  );
}

export default function TripHistoryList() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRequests([]);
      setErrorMessage("You must be signed in to view your trip history.");
      setLoading(false);
      return;
    }

    const todayDateKey = getTodayDateKeyInHawaii();

    const { data, error } = await supabase
      .from("daily_access_requests")
      .select(`
        id,
        request_date,
        purpose,
        party_size,
        vehicle_summary,
        status,
        pending_reason,
        created_at,
        gates (
          name
        ),
        access_accounts!inner (
          id,
          profile_id
        )
      `)
      .eq("access_accounts.profile_id", user.id)
      .lt("request_date", todayDateKey)
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load trip history:", error);
      setRequests([]);
      setErrorMessage(error.message || "Unable to load your trip history.");
      setLoading(false);
      return;
    }

    setRequests(sortRequestsNewestToOldest((data ?? []) as AccessRequest[]));
    setLoading(false);
  }

  if (loading) {
  return (
    <Card title="Loading Trip History...">
      <p className="text-sm text-gray-600">Please wait...</p>
    </Card>
  );
}

  if (errorMessage) {
    return (
      <Card title="Unable to Load Trip History">
        <div className="space-y-4">
          <p className="text-sm text-red-700">{errorMessage}</p>

          <button
            className="button secondary"
            type="button"
            onClick={() => void loadRequests()}
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div
          className="request-tabs"
          role="tablist"
          aria-label="Trip history"
        >
          <button
            className="request-tab active"
            type="button"
            role="tab"
            aria-selected="true"
          >
            <span>Historical Requests</span>
            <span className="request-tab-count">{requests.length}</span>
          </button>
        </div>
      </Card>

      {requests.length === 0 ? (
        <Card title="Trip History">
          <p className="text-sm text-gray-600">
            You do not have any historical access requests yet.
          </p>
        </Card>
      ) : (
        <div className="review-queue">
          {requests.map((request) => (
            <TripHistoryCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}