"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MetricTone = "ok" | "watch" | "alert";

type ActivityMetric = {
  label: string;
  value: string;
  note: string;
  badge: string;
  tone: MetricTone;
};

export default function LiveActivityBar() {
  const [metrics, setMetrics] = useState<ActivityMetric[]>([
    {
      label: "New Account Requests",
      value: "—",
      note: "Awaiting review",
      badge: "WATCH",
      tone: "watch",
    },
    {
      label: "Daily Requests Today",
      value: "—",
      note: "Ready to approve",
      badge: "OK",
      tone: "ok",
    },
    {
      label: "Entries Today",
      value: "—",
      note: "Gate codes viewed",
      badge: "OK",
      tone: "ok",
    },
    {
      label: "Gate Status",
      value: "All Open",
      note: "No restrictions",
      badge: "OK",
      tone: "ok",
    },
  ]);

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
      todaysRequestsResult,
      pendingTodayResult,
      entriesTodayResult,
    ] = await Promise.all([
      supabase
        .from("access_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      supabase
        .from("daily_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("request_date", today),

      supabase
        .from("daily_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("request_date", today),

      supabase
        .from("gate_code_reveals")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00-10:00`)
        .lt("created_at", `${tomorrow}T00:00:00-10:00`),
    ]);

    if (
      pendingAccountsResult.error ||
      todaysRequestsResult.error ||
      pendingTodayResult.error ||
      entriesTodayResult.error
    ) {
      console.error("Unable to load live activity:", {
        pendingAccountsError: pendingAccountsResult.error,
        todaysRequestsError: todaysRequestsResult.error,
        pendingTodayError: pendingTodayResult.error,
        entriesTodayError: entriesTodayResult.error,
      });

      setMetrics((currentMetrics) =>
        currentMetrics.map((metric) =>
          metric.label === "New Account Requests" ||
          metric.label === "Daily Requests Today" ||
          metric.label === "Entries Today"
            ? {
                ...metric,
                value: "!",
                note: "Unable to load",
                badge: "WATCH",
                tone: "watch",
              }
            : metric
        )
      );

      return;
    }

    const pendingAccounts = pendingAccountsResult.count ?? 0;
    const todaysRequests = todaysRequestsResult.count ?? 0;
    const pendingToday = pendingTodayResult.count ?? 0;
    const entriesToday = entriesTodayResult.count ?? 0;

    setMetrics([
      {
        label: "New Account Requests",
        value: String(pendingAccounts),
        note: "Awaiting review",
        badge: pendingAccounts > 0 ? "WATCH" : "OK",
        tone: pendingAccounts > 0 ? "watch" : "ok",
      },
      {
        label: "Daily Requests Today",
        value: String(todaysRequests),
        note:
          pendingToday === 1
            ? "1 ready to approve"
            : `${pendingToday} ready to approve`,
        badge: pendingToday > 0 ? "WATCH" : "OK",
        tone: pendingToday > 0 ? "watch" : "ok",
      },
      {
        label: "Entries Today",
        value: String(entriesToday),
        note:
          entriesToday === 1
            ? "1 gate code viewed"
            : `${entriesToday} gate codes viewed`,
        badge: "OK",
        tone: "ok",
      },
      {
        label: "Gate Status",
        value: "All Open",
        note: "No restrictions",
        badge: "OK",
        tone: "ok",
      },
    ]);
  }

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "220px repeat(4, minmax(160px, 1fr))",
        gap: "12px",
        alignItems: "stretch",
        background: "#123f22",
        borderRadius: "20px",
        padding: "18px",
        marginTop: "22px",
        marginBottom: "28px",
        color: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderRight: "1px solid rgba(255, 255, 255, 0.22)",
          paddingRight: "18px",
        }}
      >
        <div
          style={{
            color: "#f2b544",
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}
        >
          Live Activity
        </div>

        <div
          style={{
            fontSize: "1.35rem",
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          Today&apos;s Operations
        </div>
      </div>

      {metrics.map((metric) => (
        <div
          key={metric.label}
          style={{
            position: "relative",
            background: "rgba(255, 255, 255, 0.17)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            borderRadius: "16px",
            padding: "14px 14px 13px",
            minHeight: "88px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              borderRadius: "999px",
              padding: "7px 13px",
              background:
                metric.tone === "watch"
                  ? "#eee3bd"
                  : metric.tone === "alert"
                    ? "#f2c4bd"
                    : "#cfe6d0",
              color:
                metric.tone === "watch"
                  ? "#6b5200"
                  : metric.tone === "alert"
                    ? "#7c1f18"
                    : "#1e4a2a",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {metric.badge}
          </div>

          <div
            style={{
              maxWidth: "115px",
              fontSize: "0.76rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              lineHeight: 1.1,
              textTransform: "uppercase",
              opacity: 0.95,
              marginBottom: "8px",
            }}
          >
            {metric.label}
          </div>

          <div
            style={{
              fontSize: metric.label === "Gate Status" ? "1.3rem" : "1.65rem",
              fontWeight: 900,
              lineHeight: 1,
              marginBottom: "8px",
            }}
          >
            {metric.value}
          </div>

          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              opacity: 0.9,
              lineHeight: 1.2,
            }}
          >
            {metric.note}
          </div>
        </div>
      ))}
    </section>
  );
}