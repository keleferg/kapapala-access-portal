"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | string;
type RequestTab = "pending" | "approved" | "denied";

type DailyAccessRequest = {
  id: string;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  status: RequestStatus;
  pending_reason: string | null;
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

const HAWAII_TIME_ZONE = "Pacific/Honolulu";
const DAILY_QUEUE_CUTOFF_HOUR = 22;

const tabs: {
  key: RequestTab;
  label: string;
  emptyMessage: string;
}[] = [
  {
    key: "pending",
    label: "Pending",
    emptyMessage: "There are no pending daily access requests.",
  },
  {
    key: "approved",
    label: "Approved",
    emptyMessage: "There are no approved daily access requests.",
  },
  {
    key: "denied",
    label: "Denied",
    emptyMessage: "There are no denied daily access requests.",
  },
];

function getRequesterName(request: DailyAccessRequest) {
  const profile = request.access_accounts?.profiles;

  const firstName = profile?.first_name?.trim() ?? "";
  const lastName = profile?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Unknown User";
}

function getAccessId(request: DailyAccessRequest) {
  return request.access_accounts?.access_id || "Pending";
}

function getGateName(request: DailyAccessRequest) {
  return request.gates?.name || "Unknown Gate";
}

function getPurpose(request: DailyAccessRequest) {
  return request.purpose || "No purpose listed";
}

function getPartySize(request: DailyAccessRequest) {
  return request.party_size ?? 0;
}

function formatRequestDate(dateValue: string) {
  if (!dateValue) return "Unknown Date";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Unknown Date";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusTone(status: RequestStatus): "green" | "yellow" | "red" {
  if (status === "approved") return "green";
  if (status === "denied") return "red";
  return "yellow";
}

function formatStatus(status: RequestStatus) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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

  return hour >= DAILY_QUEUE_CUTOFF_HOUR;
}

function getRequestDateKey(requestDate: string) {
  return requestDate.slice(0, 10);
}

function shouldShowRequest(request: DailyAccessRequest) {
  const requestDateKey = getRequestDateKey(request.request_date);
  const todayDateKey = getTodayDateKeyInHawaii();

  const isToday = requestDateKey === todayDateKey;
  const afterCutoff = isAfterDailyCutoffInHawaii();

  if (isToday && afterCutoff) {
    return false;
  }

  return true;
}

function sortRequestsOldestToNewest(
  requests: DailyAccessRequest[]
): DailyAccessRequest[] {
  return [...requests].sort((a, b) => {
    const requestDateCompare = a.request_date.localeCompare(b.request_date);

    if (requestDateCompare !== 0) {
      return requestDateCompare;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function countByStatus(requests: DailyAccessRequest[], status: RequestTab) {
  return requests.filter((request) => request.status === status).length;
}

export default function DailyAccessRequestQueue() {
  const [requests, setRequests] = useState<DailyAccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<RequestTab>("pending");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

  const visibleRequests = useMemo(() => {
    // This keeps the queue recalculating every minute for the 10 PM cutoff.
    void currentTime;

    return sortRequestsOldestToNewest(
      requests.filter((request) => shouldShowRequest(request))
    );
  }, [requests, currentTime]);

  const filteredRequests = useMemo(() => {
    return visibleRequests.filter((request) => request.status === activeTab);
  }, [visibleRequests, activeTab]);

  const activeTabConfig = tabs.find((tab) => tab.key === activeTab);

  async function loadRequests() {
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
        status,
        pending_reason,
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
      .order("request_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to load daily access requests:", error);
      setRequests([]);
      setErrorMessage(error.message || "Unable to load daily access requests.");
      setLoading(false);
      return;
    }

    setRequests(sortRequestsOldestToNewest((data ?? []) as DailyAccessRequest[]));
    setLoading(false);
  }

  async function updateStatus(id: string, status: "approved" | "denied") {
    const confirmed = window.confirm(
      status === "approved"
        ? "Approve this access request?"
        : "Deny this access request?"
    );

    if (!confirmed) return;

    setUpdatingId(id);

    try {
      const response = await fetch(
        `/api/admin/daily-access-requests/${id}/status`,
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
        const message = result?.error || "Unable to update this access request.";
        alert(message);
        return;
      }

      setRequests((currentRequests) =>
        sortRequestsOldestToNewest(
          currentRequests.map((request) =>
            request.id === id
              ? {
                  ...request,
                  status,
                  pending_reason:
                    status === "approved" ? null : request.pending_reason,
                }
              : request
          )
        )
      );
    } catch (error) {
      console.error("Unable to update request status:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update this access request."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <Card title="Loading Requests...">
        <p className="text-sm text-gray-600">Please wait...</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card title="Unable to Load Requests">
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
          aria-label="Request status tabs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = countByStatus(visibleRequests, tab.key);

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

      {isAfterDailyCutoffInHawaii() && (
        <Card>
          <p className="text-sm text-gray-600">
            Today&apos;s daily access requests have been removed from this queue
            because it is after 10:00 PM Hawaiʻi time.
          </p>
        </Card>
      )}

      {filteredRequests.length === 0 ? (
        <Card title={`${activeTabConfig?.label ?? "Requests"} Requests`}>
          <p className="text-sm text-gray-600">
            {activeTabConfig?.emptyMessage ??
              "There are no requests in this tab."}
          </p>
        </Card>
      ) : (
        <div className="review-queue">
          {filteredRequests.map((request) => {
            const partySize = getPartySize(request);
            const isUpdating = updatingId === request.id;
            const isPending = request.status === "pending";

            return (
              <Card key={request.id}>
                <div className="review-card">
                  <div className="review-main">
                    <div className="review-avatar" aria-hidden="true">
                      🚙
                    </div>

                    <div>
                      <h3>{getRequesterName(request)}</h3>

                      <p>Access ID: {getAccessId(request)}</p>

                      <p>
                        {getGateName(request)} • {getPurpose(request)}
                      </p>

                      <div className="review-meta-row">
                        <span>{formatRequestDate(request.request_date)}</span>

                        <span>
                          {partySize} Person{partySize !== 1 ? "s" : ""}
                        </span>

                        <span>
                          {request.vehicle_summary || "No vehicle listed"}
                        </span>
                      </div>

                      {request.status === "pending" &&
                        request.pending_reason && (
                          <div className="pending-reason">
                            <strong>Pending reason:</strong>{" "}
                            {request.pending_reason}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="review-actions">
                    <StatusBadge
                      label={formatStatus(request.status)}
                      tone={statusTone(request.status)}
                    />

                    <Link
                      className="button secondary"
                      href={`/admin/requests/${request.id}`}
                    >
                      View
                    </Link>

                    {isPending && (
                      <>
                        <button
                          className="button primary"
                          type="button"
                          onClick={() =>
                            void updateStatus(request.id, "approved")
                          }
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Updating..." : "Approve"}
                        </button>

                        <button
                          className="button danger"
                          type="button"
                          onClick={() => void updateStatus(request.id, "denied")}
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Updating..." : "Deny"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}