"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MetricTone = "ok" | "watch" | "alert";
type MetricIconName = "operations" | "pending" | "accounts" | "gates";

type ActivityMetric = {
  label: string;
  value: string;
  note: string;
  badge: string;
  tone: MetricTone;
  icon: MetricIconName;
};

function MetricIcon({ name }: { name: MetricIconName }) {
  if (name === "operations") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" />
      </svg>
    );
  }

  if (name === "pending") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M8 3l-3 3M16 3l3 3" />
      </svg>
    );
  }

  if (name === "accounts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18M16 3v18M10 12h4" />
    </svg>
  );
}

const initialMetrics: ActivityMetric[] = [
  {
    label: "Today’s Operations",
    value: "—",
    note: "Loading today’s requests",
    badge: "LIVE",
    tone: "ok",
    icon: "operations",
  },
  {
    label: "Pending Access Requests",
    value: "—",
    note: "Awaiting administrative action",
    badge: "WATCH",
    tone: "watch",
    icon: "pending",
  },
  {
    label: "Active Accounts",
    value: "—",
    note: "Approved access accounts",
    badge: "OK",
    tone: "ok",
    icon: "accounts",
  },
  {
    label: "Gate Status",
    value: "—",
    note: "Loading gate conditions",
    badge: "LIVE",
    tone: "ok",
    icon: "gates",
  },
];

export default function LiveActivityBar() {
  const [metrics, setMetrics] = useState<ActivityMetric[]>(initialMetrics);

  useEffect(() => {
    void loadLiveActivity();
  }, []);

  async function loadLiveActivity() {
    const supabase = getSupabaseClient();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Pacific/Honolulu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const tomorrow = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Pacific/Honolulu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const [
      pendingAccountsResult,
      activeAccountsResult,
      todaysRequestsResult,
      pendingAccessResult,
      entriesTodayResult,
      gatesResult,
    ] = await Promise.all([
      supabase
        .from("access_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      supabase
        .from("access_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      supabase
        .from("daily_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("request_date", today),

      supabase
        .from("daily_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gte("request_date", today),

      supabase
        .from("gate_code_reveals")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00-10:00`)
        .lt("created_at", `${tomorrow}T00:00:00-10:00`),

      supabase.from("gates").select("status").eq("active", true),
    ]);

    const errors = [
      pendingAccountsResult.error,
      activeAccountsResult.error,
      todaysRequestsResult.error,
      pendingAccessResult.error,
      entriesTodayResult.error,
      gatesResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Unable to load dashboard activity:", errors);

      setMetrics(
        initialMetrics.map((metric) => ({
          ...metric,
          value: "!",
          note: "Unable to load this metric",
          badge: "WATCH",
          tone: "watch",
        }))
      );

      return;
    }

    const pendingAccounts = pendingAccountsResult.count ?? 0;
    const activeAccounts = activeAccountsResult.count ?? 0;
    const todaysRequests = todaysRequestsResult.count ?? 0;
    const pendingAccess = pendingAccessResult.count ?? 0;
    const entriesToday = entriesTodayResult.count ?? 0;

    const gateRows = (gatesResult.data ?? []) as Array<{
      status: string | null;
    }>;

    const totalGates = gateRows.length;
    const openGates = gateRows.filter(
      (gate) => gate.status?.toLowerCase() === "open"
    ).length;
    const restrictedGates = gateRows.filter(
      (gate) => gate.status?.toLowerCase() === "restricted"
    ).length;
    const closedGates = gateRows.filter(
      (gate) => gate.status?.toLowerCase() === "closed"
    ).length;

    let gateValue = "All Open";
    let gateBadge = "OK";
    let gateTone: MetricTone = "ok";

    if (closedGates > 0) {
      gateValue = `${closedGates} Closed`;
      gateBadge = "ALERT";
      gateTone = "alert";
    } else if (restrictedGates > 0) {
      gateValue = `${restrictedGates} Restricted`;
      gateBadge = "WATCH";
      gateTone = "watch";
    } else if (totalGates === 0) {
      gateValue = "—";
      gateBadge = "WATCH";
      gateTone = "watch";
    }

    setMetrics([
      {
        label: "Today’s Operations",
        value: String(todaysRequests),
        note:
          entriesToday === 1
            ? "1 gate code revealed today"
            : `${entriesToday} gate codes revealed today`,
        badge: "LIVE",
        tone: "ok",
        icon: "operations",
      },
      {
        label: "Pending Access Requests",
        value: String(pendingAccess),
        note:
          pendingAccess === 1
            ? "1 request awaiting action"
            : `${pendingAccess} requests awaiting action`,
        badge: pendingAccess > 0 ? "WATCH" : "OK",
        tone: pendingAccess > 0 ? "watch" : "ok",
        icon: "pending",
      },
      {
        label: "Active Accounts",
        value: String(activeAccounts),
        note:
          pendingAccounts === 1
            ? "1 new account application"
            : `${pendingAccounts} new account applications`,
        badge: pendingAccounts > 0 ? "WATCH" : "OK",
        tone: pendingAccounts > 0 ? "watch" : "ok",
        icon: "accounts",
      },
      {
        label: "Gate Status",
        value: gateValue,
        note:
          totalGates > 0
            ? `${openGates} of ${totalGates} gates currently open`
            : "No active gates were returned",
        badge: gateBadge,
        tone: gateTone,
        icon: "gates",
      },
    ]);
  }

  return (
    <section
      className="admin-metrics"
      aria-labelledby="admin-metrics-heading"
    >
      <div className="admin-section-heading">
        <div>
          <span>Live activity</span>
          <h2 id="admin-metrics-heading">Today&apos;s operations</h2>
        </div>

        <p>Current activity in Hawaiʻi Standard Time</p>
      </div>

      <div className="admin-metrics__grid">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`admin-metric-card admin-metric-card--${metric.tone}`}
          >
            <div className="admin-metric-card__top">
              <span className="admin-metric-card__icon">
                <MetricIcon name={metric.icon} />
              </span>

              <span className="admin-metric-card__badge">
                <span />
                {metric.badge}
              </span>
            </div>

            <span className="admin-metric-card__label">{metric.label}</span>

            <strong className="admin-metric-card__value">{metric.value}</strong>

            <p>{metric.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
