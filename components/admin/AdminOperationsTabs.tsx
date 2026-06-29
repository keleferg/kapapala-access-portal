"use client";

import { useState } from "react";
import DailyAccessQueue from "./DailyAccessQueue";
import GateCombinationManager from "./GateCombinationManager";
import PendingReviewQueue from "./PendingReviewQueue";

type AdminTab = "accounts" | "requests" | "gates";

const tabs: { id: AdminTab; label: string; count: string }[] = [
  { id: "accounts", label: "Access Account Request Queue", count: "4" },
  { id: "requests", label: "Daily Access Request Queue", count: "18" },
  { id: "gates", label: "Gate Combination Manager", count: "3" },
];

export default function AdminOperationsTabs() {
  const [activeTab, setActiveTab] = useState<AdminTab>("accounts");

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
