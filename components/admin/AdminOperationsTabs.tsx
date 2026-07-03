"use client";

import { useEffect, useState } from "react";
import DailyAccessQueue from "./DailyAccessQueue";
import GateCombinationManager from "./GateCombinationManager";
import PendingReviewQueue from "./PendingReviewQueue";
import { getSupabaseClient } from "../../lib/supabaseClient";

type AdminTab = "accounts" | "requests" | "gates";

type TabCounts = {
  accounts: number;
  requests: number;
  gates: number;
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminOperationsTabs() {
  const [activeTab, setActiveTab] = useState<AdminTab>("accounts");
  const [counts, setCounts] = useState<TabCounts>({
    accounts: 0,
    requests: 0,
    gates: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    void loadCounts();
  }, []);

  async function loadCounts() {
    setLoadingCounts(true);

    const supabase = getSupabaseClient();
    const today = todayDateString();

    const [
      pendingAccountsResult,
      todayRequestsResult,
      activeGatesResult,
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
        .from("gates")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
    ]);

    if (pendingAccountsResult.error) {
      console.error(
        "Unable to load pending account count:",
        pendingAccountsResult.error
      );
    }

    if (todayRequestsResult.error) {
      console.error(
        "Unable to load daily request count:",
        todayRequestsResult.error
      );
    }

    if (activeGatesResult.error) {
      console.error("Unable to load gate count:", activeGatesResult.error);
    }

    setCounts({
      accounts: pendingAccountsResult.count ?? 0,
      requests: todayRequestsResult.count ?? 0,
      gates: activeGatesResult.count ?? 0,
    });

    setLoadingCounts(false);
  }

  const tabs: { id: AdminTab; label: string; count: string }[] = [
    {
      id: "accounts",
      label: "Access Account Request Queue",
      count: loadingCounts ? "…" : String(counts.accounts),
    },
    {
      id: "requests",
      label: "Daily Access Request Queue",
      count: loadingCounts ? "…" : String(counts.requests),
    },
    {
      id: "gates",
      label: "Gate Combination Manager",
      count: loadingCounts ? "…" : String(counts.gates),
    },
  ];

  return (
    <section className="admin-operations-tabs">
      <div className="tab-strip" role="tablist" aria-label="Admin work queues">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {activeTab === "accounts" && <PendingReviewQueue />}
        {activeTab === "requests" && <DailyAccessQueue />}
        {activeTab === "gates" && <GateCombinationManager />}
      </div>
    </section>
  );
}