"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | "cancelled" | "completed" | string;

type NextTrip = {
  id: string;
  request_date: string;
  status: RequestStatus;
  purpose: string | null;
  created_at: string;
  gates: {
    name: string | null;
  } | null;
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowDateString(): string {
  const today = todayDateString();
  const tomorrowDate = new Date(`${today}T00:00:00`);

  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const year = tomorrowDate.getFullYear();
  const month = String(tomorrowDate.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrowDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateValue: string) {
  const today = todayDateString();
  const tomorrow = tomorrowDateString();

  if (dateValue === today) return "Today";
  if (dateValue === tomorrow) return "Tomorrow";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatStatus(status: RequestStatus) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: RequestStatus): "green" | "yellow" | "red" | "gray" {
  if (status === "approved") return "green";
  if (status === "pending") return "yellow";
  if (status === "denied" || status === "cancelled") return "red";
  return "gray";
}

export default function NextTripCard() {
  const [trip, setTrip] = useState<NextTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadNextTrip();
  }, []);

  async function loadNextTrip() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Unable to load signed-in user.");
      setLoading(false);
      return;
    }

    const today = todayDateString();

    const { data, error } = await supabase
    .from("daily_access_requests")
    .select(`
        id,
        request_date,
        status,
        purpose,
        created_at,
        access_accounts!inner (
        id,
        profile_id
        ),
        gates (
        name
        )
    `)
    .eq("access_accounts.profile_id", user.id)
    .gte("request_date", today)
    .neq("status", "cancelled")
    .neq("status", "denied")
    .order("request_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

    if (error) {
      console.error("Unable to load next trip:", error);
      setErrorMessage(error.message || "Unable to load next trip.");
      setTrip(null);
      setLoading(false);
      return;
    }

    setTrip(data as NextTrip | null);
    setLoading(false);
  }

  if (loading) {
    return (
      <Card title="Next Trip" subtitle="Upcoming access">
        <div className="dashboard-card-compact-value">Loading...</div>
        <p className="muted-text">Checking upcoming requests.</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card title="Next Trip" subtitle="Upcoming access">
        <div className="dashboard-card-compact-value">Unavailable</div>
        <StatusBadge label="Error" tone="red" />
        <p className="muted-text">{errorMessage}</p>
      </Card>
    );
  }

  if (!trip) {
    return (
      <Card title="Next Trip" subtitle="Upcoming access">
        <div className="dashboard-card-compact-value">None</div>
        <p className="muted-text">No upcoming access requests.</p>
        <Link className="button secondary compact-card-button" href="/request-access">
          Request Access
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Next Trip" subtitle="Upcoming access">
      <div className="dashboard-card-compact-value">
        {formatDate(trip.request_date)}
      </div>

      <p className="muted-text">{trip.gates?.name || "Gate not listed"}</p>

      <StatusBadge
        label={formatStatus(trip.status)}
        tone={statusTone(trip.status)}
      />
    </Card>
  );
}