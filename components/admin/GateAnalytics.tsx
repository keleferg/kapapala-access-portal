"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RangeKey = "30" | "90" | "365" | "ytd";

type DailyPoint = {
  date: string;
  requests_submitted: number;
  codes_viewed: number;
};

type GatePoint = {
  gate_id: string;
  gate_name: string;
  requests: number;
  daily_average: number;
};

type AnalyticsPayload = {
  range: RangeKey;
  start_date: string;
  end_date: string;
  days: number;
  totals: {
    requests: number;
    viewed: number;
  };
  daily: DailyPoint[];
  by_gate: GatePoint[];
};

type AnalyticsState = {
  data: AnalyticsPayload | null;
  loading: boolean;
  error: string | null;
};

const RANGE_OPTIONS: {
  value: RangeKey;
  label: string;
}[] = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "365 days" },
  { value: "ytd", label: "YTD" },
];

const GATE_COLORS: Record<string, string> = {
  Honanui: "#286548",
  "ʻĀinapō": "#d2a839",
  "Wood Valley": "#688a76",
};

const FALLBACK_COLORS = [
  "#286548",
  "#d2a839",
  "#688a76",
  "#4778a6",
];

function formatShortDate(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getGateColor(gateName: string, index: number) {
  return (
    GATE_COLORS[gateName] ||
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

function RangeSelector({
  value,
  onChange,
  label,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  label: string;
}) {
  return (
    <div
      className="gate-analytics-range"
      role="group"
      aria-label={label}
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? "gate-analytics-range__button active"
              : "gate-analytics-range__button"
          }
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function useGateAnalytics(range: RangeKey) {
  const [refreshToken, setRefreshToken] = useState(0);

  const [state, setState] = useState<AnalyticsState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadAnalytics() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const supabase = getSupabaseClient();

      const { data, error } = await (supabase as any).rpc(
        "get_admin_gate_analytics",
        {
          p_range: range,
        }
      );

      if (!isCurrent) return;

      if (error) {
        console.error("Unable to load gate analytics:", error);

        setState({
          data: null,
          loading: false,
          error: error.message || "Unable to load gate analytics.",
        });

        return;
      }

      try {
        const parsed =
          typeof data === "string"
            ? (JSON.parse(data) as AnalyticsPayload)
            : (data as AnalyticsPayload);

        setState({
          data: parsed,
          loading: false,
          error: null,
        });
      } catch (parseError) {
        console.error("Unable to parse gate analytics:", parseError);

        setState({
          data: null,
          loading: false,
          error: "The gate analytics response could not be read.",
        });
      }
    }

    void loadAnalytics();

    return () => {
      isCurrent = false;
    };
  }, [range, refreshToken]);

  return {
    ...state,
    reload: () => setRefreshToken((current) => current + 1),
  };
}

function AnalyticsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="gate-analytics-state gate-analytics-state--error">
      <strong>Unable to load analytics</strong>
      <p>{message}</p>

      <button
        type="button"
        className="button secondary"
        onClick={onRetry}
      >
        Try Again
      </button>
    </div>
  );
}

export default function GateAnalytics() {
  const [lineRange, setLineRange] = useState<RangeKey>("30");
  const [pieRange, setPieRange] = useState<RangeKey>("30");

  const lineAnalytics = useGateAnalytics(lineRange);
  const pieAnalytics = useGateAnalytics(pieRange);

  const viewRate = lineAnalytics.data?.totals.requests
    ? Math.round(
        (lineAnalytics.data.totals.viewed /
          lineAnalytics.data.totals.requests) *
          100
      )
    : 0;

  const pieData = useMemo(() => {
    return (pieAnalytics.data?.by_gate || []).map((gate, index) => ({
      ...gate,
      fill: getGateColor(gate.gate_name, index),
    }));
  }, [pieAnalytics.data]);

  const pieTotal = pieData.reduce(
    (total, gate) => total + gate.requests,
    0
  );

  return (
    <section
      className="gate-analytics"
      aria-labelledby="gate-analytics-title"
    >
      <div className="gate-analytics__heading">
        <div>
          <span>Historical activity</span>
          <h3 id="gate-analytics-title">Gate analytics</h3>
        </div>

        <p>
          Request submissions, code-reveal activity, and request
          distribution across each gate.
        </p>
      </div>

      <div className="gate-analytics__grid">
        <article className="gate-analytics-card gate-analytics-card--line">
          <header className="gate-analytics-card__header">
            <div>
              <span className="gate-analytics-card__eyebrow">
                Request activity
              </span>

              <h4>Requests submitted and codes viewed</h4>

              <p>
                Each viewed request is counted once, even when its code
                was revealed multiple times.
              </p>
            </div>

            <RangeSelector
              value={lineRange}
              onChange={setLineRange}
              label="Select request activity date range"
            />
          </header>

          {lineAnalytics.loading ? (
            <div className="gate-analytics-state">
              Loading request activity…
            </div>
          ) : lineAnalytics.error ? (
            <AnalyticsError
              message={lineAnalytics.error}
              onRetry={lineAnalytics.reload}
            />
          ) : lineAnalytics.data ? (
            <>
              <div className="gate-analytics-summary">
                <div>
                  <span>Requests submitted</span>
                  <strong>
                    {lineAnalytics.data.totals.requests.toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span>Codes viewed</span>
                  <strong>
                    {lineAnalytics.data.totals.viewed.toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span>View rate</span>
                  <strong>{viewRate}%</strong>
                </div>
              </div>

              <div className="gate-analytics-chart-shell">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={lineAnalytics.data.daily}
                    margin={{
                      top: 10,
                      right: 14,
                      bottom: 4,
                      left: -12,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8e3"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      minTickGap={28}
                      tickLine={false}
                      axisLine={{
                        stroke: "#d8e0da",
                      }}
                      tick={{
                        fill: "#738078",
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fill: "#738078",
                        fontSize: 11,
                      }}
                    />

                    <Tooltip
                      labelFormatter={(label) =>
                        formatLongDate(String(label))
                      }
                    />

                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={38}
                    />

                    <Line
                      type="monotone"
                      dataKey="requests_submitted"
                      name="Requests submitted"
                      stroke="#286548"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="codes_viewed"
                      name="Codes viewed"
                      stroke="#d2a839"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="gate-analytics-card__period">
                {formatLongDate(lineAnalytics.data.start_date)}
                {" – "}
                {formatLongDate(lineAnalytics.data.end_date)}
              </p>
            </>
          ) : null}
        </article>

        <article className="gate-analytics-card gate-analytics-card--pie">
          <header className="gate-analytics-card__header">
            <div>
              <span className="gate-analytics-card__eyebrow">
                Gate distribution
              </span>

              <h4>Requests by gate</h4>

              <p>
                Total requests and daily average for each gate.
              </p>
            </div>

            <RangeSelector
              value={pieRange}
              onChange={setPieRange}
              label="Select gate distribution date range"
            />
          </header>

          {pieAnalytics.loading ? (
            <div className="gate-analytics-state">
              Loading gate distribution…
            </div>
          ) : pieAnalytics.error ? (
            <AnalyticsError
              message={pieAnalytics.error}
              onRetry={pieAnalytics.reload}
            />
          ) : pieTotal === 0 ? (
            <div className="gate-analytics-state">
              No requests were submitted during this period.
            </div>
          ) : (
            <>
              <div className="gate-analytics-pie">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="requests"
                      nameKey="gate_name"
                      innerRadius="58%"
                      outerRadius="83%"
                      paddingAngle={3}
                      stroke="#ffffff"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {pieData.map((gate) => (
                        <Cell
                          key={gate.gate_id}
                          fill={gate.fill}
                        />
                      ))}
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="gate-analytics-pie__center">
                  <strong>{pieTotal.toLocaleString()}</strong>
                  <span>requests</span>
                </div>
              </div>

              <div className="gate-analytics-gate-list">
                {pieData.map((gate) => {
                  const percentage = pieTotal
                    ? Math.round(
                        (gate.requests / pieTotal) * 100
                      )
                    : 0;

                  return (
                    <div
                      className="gate-analytics-gate-row"
                      key={gate.gate_id}
                    >
                      <span
                        className="gate-analytics-gate-row__color"
                        style={{
                          background: gate.fill,
                        }}
                      />

                      <div>
                        <strong>{gate.gate_name}</strong>

                        <small>
                          {gate.daily_average.toLocaleString()} per day
                        </small>
                      </div>

                      <div className="gate-analytics-gate-row__value">
                        <strong>
                          {gate.requests.toLocaleString()}
                        </strong>

                        <small>{percentage}%</small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="gate-analytics-card__period">
                {pieAnalytics.data
                  ? formatLongDate(pieAnalytics.data.start_date)
                  : ""}
                {" – "}
                {pieAnalytics.data
                  ? formatLongDate(pieAnalytics.data.end_date)
                  : ""}
              </p>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
