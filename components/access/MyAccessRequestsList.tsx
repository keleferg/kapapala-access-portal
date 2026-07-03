"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | "cancelled" | string;
type RequestTab = "current" | "past";

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
const DAILY_PAST_CUTOFF_HOUR = 22;

const tabs: {
  key: RequestTab;
  label: string;
  emptyMessage: string;
}[] = [
  {
    key: "current",
    label: "Current",
    emptyMessage: "You do not have any current access requests.",
  },
  {
    key: "past",
    label: "Past",
    emptyMessage: "You do not have any past access requests from the last year.",
  },
];

function getHawaiiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: Number(getPart("hour")),
  };
}

function getTodayDateKeyInHawaii() {
  const { year, month, day } = getHawaiiDateParts();

  return `${year}-${month}-${day}`;
}

function isAfterDailyCutoffInHawaii() {
  const { hour } = getHawaiiDateParts();

  return hour >= DAILY_PAST_CUTOFF_HOUR;
}

function getRequestDateKey(requestDate: string) {
  return requestDate.slice(0, 10);
}

function getOneYearAgoDateKeyInHawaii() {
  const now = new Date();
  const oneYearAgo = new Date(now);

  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(oneYearAgo);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function isPastRequest(request: AccessRequest) {
  const requestDateKey = getRequestDateKey(request.request_date);
  const todayDateKey = getTodayDateKeyInHawaii();

  if (requestDateKey < todayDateKey) {
    return true;
  }

  if (requestDateKey === todayDateKey && isAfterDailyCutoffInHawaii()) {
    return true;
  }

  return false;
}

function sortRequestsOldestToNewest(requests: AccessRequest[]) {
  return [...requests].sort((a, b) => {
    const requestDateCompare = a.request_date.localeCompare(b.request_date);

    if (requestDateCompare !== 0) {
      return requestDateCompare;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function sortPastRequestsNewestToOldest(requests: AccessRequest[]) {
  return [...requests].sort((a, b) => {
    const requestDateCompare = b.request_date.localeCompare(a.request_date);

    if (requestDateCompare !== 0) {
      return requestDateCompare;
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

function formatRequestDate(dateValue: string | null) {
  if (!dateValue) return "Unknown Date";

  const dateOnly = dateValue.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Unknown Date";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) return "Unknown Date";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown Date";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
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

function countByTab(requests: AccessRequest[], tab: RequestTab) {
  return requests.filter((request) =>
    tab === "past" ? isPastRequest(request) : !isPastRequest(request)
  ).length;
}

function RequestCard({
  request,
  onCancel,
  cancellingId,
}: {
  request: AccessRequest;
  onCancel: (requestId: string) => void;
  cancellingId: string | null;
}) {
  const partySize = request.party_size ?? 0;
  const isCancelling = cancellingId === request.id;

  return (
    <Card>
      <div className="review-card">
        <div className="review-main">
          <div className="review-avatar" aria-hidden="true">
            📅
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

          {request.status === "pending" && request.pending_reason && (
            <Link
              className="button secondary"
              href={`/my-access-requests/${request.id}/edit`}
            >
              Edit Request
            </Link>
          )}

          {request.status === "approved" && (
            <button
              className="button danger"
              type="button"
              onClick={() => onCancel(request.id)}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Request"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MyAccessRequestsList() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<RequestTab>("current");
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredRequests = useMemo(() => {
    currentTime;

    const visibleRequests = requests.filter((request) =>
      activeTab === "past" ? isPastRequest(request) : !isPastRequest(request)
    );

    return activeTab === "past"
      ? sortPastRequestsNewestToOldest(visibleRequests)
      : sortRequestsOldestToNewest(visibleRequests);
  }, [requests, activeTab, currentTime]);

  const activeTabConfig = tabs.find((tab) => tab.key === activeTab);

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
      setErrorMessage("You must be signed in to view your access requests.");
      setLoading(false);
      return;
    }

    const oneYearAgoDateKey = getOneYearAgoDateKeyInHawaii();

    const { data, error } = await (supabase as any)
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
      .gte("request_date", oneYearAgoDateKey)
      .order("request_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to load user access requests:", error);
      setRequests([]);
      setErrorMessage(error.message || "Unable to load your access requests.");
      setLoading(false);
      return;
    }

    setRequests((data ?? []) as AccessRequest[]);
    setLoading(false);
  }

  async function cancelRequest(requestId: string) {
    const confirmed = window.confirm(
      "Cancel this approved access request? This cannot be undone."
    );

    if (!confirmed) return;

    setCancellingId(requestId);

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase as any)
        .from("daily_access_requests")
        .update({
          status: "cancelled",
          pending_reason: null,
        })
        .eq("id", requestId)
        .eq("status", "approved");

      if (error) {
        console.error("Unable to cancel access request:", error);
        alert(error.message || "Unable to cancel this request.");
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "cancelled",
                pending_reason: null,
              }
            : request
        )
      );
    } catch (error) {
      console.error("Unable to cancel access request:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to cancel this request."
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
  return (
    <Card title="Loading Access Requests...">
      <p className="text-sm text-gray-600">Please wait...</p>
    </Card>
  );
}

  if (errorMessage) {
    return (
      <Card title="Unable to Load Access Requests">
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
          aria-label="My access request tabs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = countByTab(requests, tab.key);

            return (
              <button
                key={tab.key}
                className={`request-tab ${isActive ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="request-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {filteredRequests.length === 0 ? (
        <Card title={`${activeTabConfig?.label ?? "Access"} Requests`}>
          <p className="text-sm text-gray-600">
            {activeTabConfig?.emptyMessage ??
              "There are no access requests in this tab."}
          </p>
        </Card>
      ) : (
        <div className="review-queue">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onCancel={cancelRequest}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}