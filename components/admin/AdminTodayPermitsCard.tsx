"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

type TodayPermit = {
  id: string;
  permit_no: string | null;
  permittee: string | null;
  phone: string | null;
  check_in: string | null;
  check_out: string | null;
  guest_count: number | null;
  report_id: string | null;
  report_date_hst: string | null;
  processing_status: string | null;
  matched_request_count: number | null;
};

function formatPermittee(value: string | null): string {
  const cleaned = value?.trim() ?? "";

  if (!cleaned) {
    return "Unnamed permittee";
  }

  if (!cleaned.includes(",")) {
    return cleaned;
  }

  const [last, first] = cleaned.split(",").map((part) => part.trim());
  return [first, last].filter(Boolean).join(" ");
}

function formatDateRange(
  checkIn: string | null,
  checkOut: string | null
): string {
  if (!checkIn && !checkOut) {
    return "Dates unavailable";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Pacific/Honolulu",
  });

  const parseDate = (value: string | null) =>
    value ? new Date(`${value}T12:00:00-10:00`) : null;

  const start = parseDate(checkIn);
  const end = parseDate(checkOut);

  if (start && end) {
    return `${formatter.format(start)}–${formatter.format(end)}`;
  }

  return formatter.format(start ?? end!);
}

export default function AdminTodayPermitsCard() {
  const [permits, setPermits] = useState<TodayPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadPermits();
  }, []);

  async function loadPermits() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any).rpc(
      "get_admin_today_ainapo_permits"
    );

    if (error) {
      console.error("Unable to load today's DLNR permits:", error);
      setPermits([]);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setPermits((data ?? []) as TodayPermit[]);
    setLoading(false);
  }

  return (
    <section className="admin-today-permits">
      <div className="admin-section-heading">
        <div>
          <span>DLNR ʻĀinapō</span>
          <h2>Permits</h2>
        </div>

        <p>Approved cabin permits valid today</p>
      </div>

      <div className="admin-today-permits__card">
        <div className="admin-today-permits__summary">
          <div>
            <strong>{loading ? "…" : permits.length}</strong>
            <span>{permits.length === 1 ? "Permit Today" : "Permits Today"}</span>
          </div>

          <button
            type="button"
            onClick={() => void loadPermits()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="admin-today-permits__empty">
            Loading today&apos;s permits…
          </p>
        ) : errorMessage ? (
          <p className="admin-today-permits__error">
            Unable to load permits: {errorMessage}
          </p>
        ) : permits.length === 0 ? (
          <p className="admin-today-permits__empty">
            No approved DLNR ʻĀinapō cabin permits for today.
          </p>
        ) : (
          <div className="admin-today-permits__list">
            {permits.map((permit) => (
              <article
                key={permit.id}
                className="admin-today-permits__permit"
              >
                <div>
                  <strong>
                    {permit.permit_no?.trim() || "No permit number"}
                  </strong>

                  <span>{formatPermittee(permit.permittee)}</span>
                </div>

                <div className="admin-today-permits__meta">
                  <span>
                    {formatDateRange(permit.check_in, permit.check_out)}
                  </span>

                  <span>
                    {permit.guest_count ?? 0}{" "}
                    {(permit.guest_count ?? 0) === 1 ? "guest" : "guests"}
                  </span>

                  <span>
                    {permit.matched_request_count ?? 0} matched request
                    {(permit.matched_request_count ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
