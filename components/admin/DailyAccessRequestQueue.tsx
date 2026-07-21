"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | string;
type RequestTab = "pending" | "approved" | "denied";
type DateFilterMode = "today" | "tomorrow" | "single" | "range";

type DailyAccessRequest = {
  id: string;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  status: RequestStatus;
  pending_reason: string | null;
  created_at: string;
  ainapo_permit_verified: boolean;
  ainapo_permit_match_method: string | null;
  ainapo_permit_match_confidence: number | null;
  ainapo_permit_id: string | null;

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

const tabs: {
  key: RequestTab;
  label: string;
  emptyMessage: string;
}[] = [
  {
    key: "pending",
    label: "Pending",
    emptyMessage:
      "There are no pending daily access requests for this date filter.",
  },
  {
    key: "approved",
    label: "Approved",
    emptyMessage:
      "There are no approved daily access requests for this date filter.",
  },
  {
    key: "denied",
    label: "Denied",
    emptyMessage:
      "There are no denied daily access requests for this date filter.",
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

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function getHawaiiDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getRequestDateKey(requestDate: string) {
  return requestDate.slice(0, 10);
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

function getDateFilterLabel(
  mode: DateFilterMode,
  selectedDate: string,
  rangeStartDate: string,
  rangeEndDate: string
) {
  if (mode === "today") return `Today: ${formatRequestDate(getHawaiiDate(0))}`;

  if (mode === "tomorrow") {
    return `Tomorrow: ${formatRequestDate(getHawaiiDate(1))}`;
  }

  if (mode === "single" && selectedDate) {
    return `Selected Date: ${formatRequestDate(selectedDate)}`;
  }

  if (mode === "range" && rangeStartDate && rangeEndDate) {
    return `Date Range: ${formatRequestDate(
      rangeStartDate
    )} through ${formatRequestDate(rangeEndDate)}`;
  }

  if (mode === "single") return "Select a date";
  return "Select a date range";
}

export default function DailyAccessRequestQueue() {
  const [requests, setRequests] = useState<DailyAccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<RequestTab>("pending");
  const [dateFilterMode, setDateFilterMode] =
    useState<DateFilterMode>("today");
  const [selectedDate, setSelectedDate] = useState(getHawaiiDate(0));
  const [rangeStartDate, setRangeStartDate] = useState(getHawaiiDate(0));
  const [rangeEndDate, setRangeEndDate] = useState(getHawaiiDate(1));
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests({
      mode: "today",
      selectedDate: getHawaiiDate(0),
      rangeStartDate: getHawaiiDate(0),
      rangeEndDate: getHawaiiDate(1),
    });
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => request.status === activeTab);
  }, [requests, activeTab]);

  const activeTabConfig = tabs.find((tab) => tab.key === activeTab);

  async function loadRequests(
    options?: Partial<{
      mode: DateFilterMode;
      selectedDate: string;
      rangeStartDate: string;
      rangeEndDate: string;
    }>
  ) {
    const mode = options?.mode ?? dateFilterMode;
    const singleDate = options?.selectedDate ?? selectedDate;
    const startDate = options?.rangeStartDate ?? rangeStartDate;
    const endDate = options?.rangeEndDate ?? rangeEndDate;

    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    let query = (supabase as any)
      .from("daily_access_requests")
      .select(
        `
        id,
        request_date,
        purpose,
        party_size,
        vehicle_summary,
        status,
        pending_reason,
        created_at,
        ainapo_permit_verified,
        ainapo_permit_match_method,
        ainapo_permit_match_confidence,
        ainapo_permit_id,
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
      `
      )
      .order("request_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (mode === "today") {
      query = query.eq("request_date", getHawaiiDate(0));
    }

    if (mode === "tomorrow") {
      query = query.eq("request_date", getHawaiiDate(1));
    }

    if (mode === "single") {
      if (!singleDate) {
        setRequests([]);
        setErrorMessage("Please select a date.");
        setLoading(false);
        return;
      }

      query = query.eq("request_date", singleDate);
    }

    if (mode === "range") {
      if (!startDate || !endDate) {
        setRequests([]);
        setErrorMessage("Please select a start date and end date.");
        setLoading(false);
        return;
      }

      if (startDate > endDate) {
        setRequests([]);
        setErrorMessage("The start date must be before the end date.");
        setLoading(false);
        return;
      }

      query = query.gte("request_date", startDate).lte("request_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Unable to load daily access requests:", error);
      setRequests([]);
      setErrorMessage(error.message || "Unable to load daily access requests.");
      setLoading(false);
      return;
    }

    setRequests(
      sortRequestsOldestToNewest((data ?? []) as DailyAccessRequest[])
    );
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

  function activateTodayFilter() {
    const today = getHawaiiDate(0);

    setDateFilterMode("today");
    setSelectedDate(today);

    void loadRequests({
      mode: "today",
      selectedDate: today,
    });
  }

  function activateTomorrowFilter() {
    const tomorrow = getHawaiiDate(1);

    setDateFilterMode("tomorrow");
    setSelectedDate(tomorrow);

    void loadRequests({
      mode: "tomorrow",
      selectedDate: tomorrow,
    });
  }

  function applySingleDateFilter() {
    setDateFilterMode("single");

    void loadRequests({
      mode: "single",
      selectedDate,
    });
  }

  function applyDateRangeFilter() {
    setDateFilterMode("range");

    void loadRequests({
      mode: "range",
      rangeStartDate,
      rangeEndDate,
    });
  }

  return (
    <div className="space-y-4">
      <Card title="Request Date Filter">
        <div className="filter-chip-row">
          <button
            className={`filter-chip ${
              dateFilterMode === "today" ? "active" : ""
            }`}
            type="button"
            onClick={activateTodayFilter}
          >
            Today
          </button>

          <button
            className={`filter-chip ${
              dateFilterMode === "tomorrow" ? "active" : ""
            }`}
            type="button"
            onClick={activateTomorrowFilter}
          >
            Tomorrow
          </button>

          <button
            className={`filter-chip ${
              dateFilterMode === "single" ? "active" : ""
            }`}
            type="button"
            onClick={() => setDateFilterMode("single")}
          >
            Select Date
          </button>

          <button
            className={`filter-chip ${
              dateFilterMode === "range" ? "active" : ""
            }`}
            type="button"
            onClick={() => setDateFilterMode("range")}
          >
            Date Range
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {dateFilterMode === "single" && (
          <div className="daily-request-date-controls">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            <button
              className="button primary"
              type="button"
              onClick={applySingleDateFilter}
              disabled={loading}
            >
              Apply Date
            </button>
          </div>
        )}

        {dateFilterMode === "range" && (
          <div className="daily-request-date-controls">
            <input
              type="date"
              value={rangeStartDate}
              onChange={(event) => setRangeStartDate(event.target.value)}
            />

            <input
              type="date"
              value={rangeEndDate}
              onChange={(event) => setRangeEndDate(event.target.value)}
            />

            <button
              className="button primary"
              type="button"
              onClick={applyDateRangeFilter}
              disabled={loading}
            >
              Apply Range
            </button>
          </div>
        )}

        <p className="muted-text" style={{ marginTop: 12 }}>
          Showing requests for{" "}
          <strong>
            {getDateFilterLabel(
              dateFilterMode,
              selectedDate,
              rangeStartDate,
              rangeEndDate
            )}
          </strong>
        </p>
      </Card>

      <Card>
        <div
          className="request-tabs"
          role="tablist"
          aria-label="Request status tabs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = countByStatus(requests, tab.key);

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

      {loading ? (
        <Card title="Loading Requests...">
          <p className="muted-text">Please wait...</p>
        </Card>
      ) : errorMessage ? (
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
      ) : filteredRequests.length === 0 ? (
        <Card title={`${activeTabConfig?.label ?? "Requests"} Requests`}>
          <p className="muted-text">
            {activeTabConfig?.emptyMessage ??
              "There are no requests in this tab."}
          </p>
        </Card>
      ) : (
        <Card title={`${activeTabConfig?.label ?? "Requests"} Requests`}>
          <div className="daily-request-table-wrap">
            <div className="daily-request-table">
              <div className="daily-request-header">
                <span>Requester</span>
                <span>Access ID</span>
                <span>Gate</span>
                <span>Date</span>
                <span>Purpose</span>
                <span>Party</span>
                <span>Vehicle</span>
                <span>Status / Actions</span>
              </div>

              {filteredRequests.map((request) => {
                const partySize = getPartySize(request);
                const isUpdating = updatingId === request.id;
                const isPending = request.status === "pending";
                const isAinapoPermitVerified =
                  request.ainapo_permit_verified === true;

                return (
                  <div
                    className={`daily-request-row ${
                      isAinapoPermitVerified
                        ? "ainapo-permit-verified-row"
                        : ""
                    }`}
                    key={request.id}
                  >
                    <strong>{getRequesterName(request)}</strong>

                    <span>{getAccessId(request)}</span>

                    <span>{getGateName(request)}</span>

                    <span>
                      {formatRequestDate(
                        getRequestDateKey(request.request_date)
                      )}
                    </span>

                    <span className="truncate">{getPurpose(request)}</span>

                    <span className="party-cell">{partySize}</span>

                    <span className="truncate">
                      {request.vehicle_summary || "No vehicle listed"}
                    </span>

                    <div className="daily-request-status-cell">
                      <StatusBadge
                        label={formatStatus(request.status)}
                        tone={statusTone(request.status)}
                      />

                      {isAinapoPermitVerified && (
                        <span
                          className="ainapo-permit-verified-badge"
                          title={[
                            "DLNR ʻĀinapō Cabin permit verified",
                            request.ainapo_permit_match_method
                              ? `Match: ${request.ainapo_permit_match_method}`
                              : null,
                            request.ainapo_permit_match_confidence != null
                              ? `Confidence: ${request.ainapo_permit_match_confidence}%`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          DLNR Verified
                        </span>
                      )}

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
                            onClick={() =>
                              void updateStatus(request.id, "denied")
                            }
                            disabled={isUpdating}
                          >
                            {isUpdating ? "Updating..." : "Deny"}
                          </button>
                        </>
                      )}
                    </div>

                    {request.status === "pending" &&
                      request.pending_reason && (
                        <div className="daily-request-pending-reason">
                          <strong>Pending reason:</strong>{" "}
                          {request.pending_reason}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}