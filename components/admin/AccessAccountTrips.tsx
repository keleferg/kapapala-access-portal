"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type AccessAccountTripsProps = {
  accountId: string;
};

type AccessAccount = {
  id: string;
  access_id: string | null;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
};

type GateRecord = {
  name: string | null;
};

type DailyAccessRequest = {
  id: string;
  request_date: string | null;
  status: string | null;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  created_at: string | null;
  gates: GateRecord | GateRecord[] | null;
};

type TripSummaryWindow = {
  label: string;
  days: number | null;
  requested: number;
  revealed: number;
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(status: string | null) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getAccountName(account: AccessAccount | null) {
  if (!account) return "Unknown Account";

  const firstName = account.applicant_first_name || "";
  const lastName = account.applicant_last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Unknown Account";
}

function getTone(status: string | null): "green" | "yellow" | "red" {
  if (status === "approved" || status === "completed") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function getGateName(gates: GateRecord | GateRecord[] | null) {
  if (!gates) return "—";

  if (Array.isArray(gates)) {
    return gates[0]?.name || "—";
  }

  return gates.name || "—";
}

function isWithinDays(requestDate: string | null, days: number | null) {
  if (!requestDate) return false;
  if (days === null) return true;

  const today = new Date();
  const start = new Date();

  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - days);

  const tripDate = new Date(`${requestDate}T00:00:00`);

  if (Number.isNaN(tripDate.getTime())) return false;

  tripDate.setHours(0, 0, 0, 0);

  return tripDate >= start && tripDate <= today;
}

export default function AccessAccountTrips({
  accountId,
}: AccessAccountTripsProps) {
  const [account, setAccount] = useState<AccessAccount | null>(null);
  const [requests, setRequests] = useState<DailyAccessRequest[]>([]);
  const [revealedRequestIds, setRevealedRequestIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTrips() {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { data: accountData, error: accountError } = await supabase
        .from("access_accounts")
        .select(
          `
          id,
          access_id,
          applicant_first_name,
          applicant_last_name
        `
        )
        .eq("id", accountId)
        .single();

      setAccount(accountData as AccessAccount);

      const { data: requestData, error: requestError } = await supabase
        .from("daily_access_requests")
        .select(
          `
          id,
          request_date,
          status,
          purpose,
          party_size,
          vehicle_summary,
          created_at,
          gates (
            name
          )
        `
        )
        .eq("access_account_id", accountId)
        .order("request_date", { ascending: false });

      if (requestError) {
        throw requestError;
      }

      const trips = (requestData ?? []) as DailyAccessRequest[];
      setRequests(trips);

      const requestIds = trips.map((request) => request.id).filter(isString);

      if (requestIds.length === 0) {
        setRevealedRequestIds(new Set<string>());
        return;
      }

      let revealIds = new Set<string>();

      const { data: revealDataByRequestId, error: revealErrorByRequestId } =
        await supabase
          .from("gate_code_reveals")
          .select("request_id")
          .in("request_id", requestIds);

      if (!revealErrorByRequestId && revealDataByRequestId) {
        revealIds = new Set<string>(
          revealDataByRequestId
            .map((row: { request_id: string | null }) => row.request_id)
            .filter(isString)
        );
      } else {
        const {
          data: revealDataByDailyRequestId,
          error: revealErrorByDailyRequestId,
        } = await supabase
          .from("gate_code_reveals")
          .select("daily_access_request_id")
          .in("daily_access_request_id", requestIds);

        if (!revealErrorByDailyRequestId && revealDataByDailyRequestId) {
          revealIds = new Set<string>(
            revealDataByDailyRequestId
              .map(
                (row: { daily_access_request_id: string | null }) =>
                  row.daily_access_request_id
              )
              .filter(isString)
          );
        }
      }

      setRevealedRequestIds(revealIds);
    } catch (error) {
      console.error("Failed to load account trips:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load account trip history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTrips();
  }, [accountId]);

  const summaryWindows = useMemo<TripSummaryWindow[]>(() => {
    const windows = [
      { label: "Last 30 Days", days: 30 },
      { label: "Last 90 Days", days: 90 },
      { label: "Last 365 Days", days: 365 },
      { label: "Lifetime Trips", days: null },
    ];

    return windows.map((window) => {
      const tripsInWindow = requests.filter((request) =>
        isWithinDays(request.request_date, window.days)
      );

      const revealedInWindow = tripsInWindow.filter((request) =>
        revealedRequestIds.has(request.id)
      );

      return {
        label: window.label,
        days: window.days,
        requested: tripsInWindow.length,
        revealed: revealedInWindow.length,
      };
    });
  }, [requests, revealedRequestIds]);

  return (
    <div className="account-trips-page">
      <div className="page-heading">
        <p>Administration</p>
        <h2>Account Trip History</h2>
        <span>
          Review trip request activity and gate code reveal activity for this
          access account.
        </span>
      </div>

      <div className="account-trips-back-row">
        <Link className="button secondary" href="/admin/access-accounts">
          Back to Access Accounts
        </Link>

        <div className="account-trips-account-label">
          <strong>{account ? getAccountName(account) : "Loading account..."}</strong>
          <span>Access ID: {account?.access_id || "Pending"}</span>
        </div>
      </div>

      <section className="account-trips-summary-panel">
        <Card title="Trip Activity Summary">
          {loading ? (
            <p className="muted-text">Loading trip activity...</p>
          ) : error ? (
            <div className="error-callout">
              <strong>Unable to load trips</strong>
              <p>{error}</p>
            </div>
          ) : (
            <div className="trip-summary-grid">
              {summaryWindows.map((summary) => (
                <div className="trip-summary-counter" key={summary.label}>
                  <span>{summary.label}</span>

                  <div>
                    <strong>{summary.requested}</strong>
                    <small>Trips Requested</small>
                  </div>

                  <div>
                    <strong>{summary.revealed}</strong>
                    <small>Gate Code Revealed</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card title="Trip Requests">
        {loading && <p className="muted-text">Loading trips...</p>}

        {!loading && !error && requests.length === 0 && (
          <p className="muted-text">
            This account does not have any trip requests yet.
          </p>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="trip-history-table-wrap">
            <table className="trip-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gate</th>
                  <th>Status</th>
                  <th>Gate Code Revealed</th>
                  <th>Party Size</th>
                  <th>Vehicle</th>
                  <th>Purpose</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => {
                  const revealed = revealedRequestIds.has(request.id);

                  return (
                    <tr key={request.id}>
                      <td>{formatDate(request.request_date)}</td>
                      <td>{getGateName(request.gates)}</td>
                      <td>
                        <StatusBadge
                          label={formatStatus(request.status)}
                          tone={getTone(request.status)}
                        />
                      </td>
                      <td>{revealed ? "Yes" : "No"}</td>
                      <td>{request.party_size ?? "—"}</td>
                      <td>{request.vehicle_summary || "—"}</td>
                      <td>{request.purpose || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}