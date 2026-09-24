"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { getSupabaseClient } from "../../../lib/supabaseClient";

type LogRow = {
  id: string;
  occurred_at: string;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  severity: string | null;
  summary: string | null;
  source: string | null;
  details: unknown;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SystemLogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");

  async function loadLog() {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data, error: rpcError } = await (supabase as any).rpc(
      "get_admin_system_activity_log",
      {
        p_start_date: start.toISOString().slice(0, 10),
        p_end_date: end.toISOString().slice(0, 10),
        p_action: null,
        p_severity: severity === "all" ? null : severity,
        p_search: null,
      }
    );

    if (rpcError) {
      setError(rpcError.message || "Unable to load the system log.");
      setRows([]);
    } else {
      setRows((data || []) as LogRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void loadLog(); }, [severity]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.actor_name,row.actor_email,row.actor_role,row.action,row.entity_type,row.severity,row.summary,row.source,JSON.stringify(row.details)]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>System Log</h2>
        <span>Live chronological audit trail of administrative, account, access, gate, notification, and system activity.</span>
      </div>

      <Card title="Recent System Activity">
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input
            aria-label="Search system log"
            placeholder="Search actor, action, target, source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 320px" }}
          />
          <select aria-label="Filter severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button type="button" className="button secondary" onClick={() => void loadLog()}>Refresh</button>
        </div>

        {error ? <p className="form-message">{error}</p> : null}
        {loading ? <p>Loading system activity…</p> : null}
        {!loading && !error && filtered.length === 0 ? <p>No system activity found for the last 30 days.</p> : null}

        {!loading && filtered.length > 0 ? (
          <div className="system-log-table">
            <div>
              <span>Time (HST)</span><span>Actor</span><span>Action</span><span>Target</span><span>Status</span>
            </div>
            {filtered.map((row) => {
              const tone = row.severity === "error" ? "red" : row.severity === "warning" ? "yellow" : "green";
              return (
                <div key={row.id}>
                  <strong>{formatTime(row.occurred_at)}</strong>
                  <span>{row.actor_name || row.actor_email || label(row.actor_role) || "System"}</span>
                  <span title={row.summary || undefined}>{row.summary || label(row.action)}</span>
                  <span>{label(row.entity_type)}</span>
                  <StatusBadge label={label(row.severity || "info")} tone={tone} />
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
