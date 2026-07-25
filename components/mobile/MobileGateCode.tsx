"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import { getSupabaseClient } from "@/lib/supabaseClient";

type EligibleRequest = {
  id: string;
  gate_id: string;
  request_date: string;
  status: string;
  gates: {
    name: string | null;
  } | null;
};

type GateCodeRevealRow = {
  can_reveal: boolean;
  reason: string | null;
  gate_id: string | null;
  gate_name: string | null;
  code: string | null;
  valid_from: string | null;
  valid_until: string | null;
  ibeacon_required: boolean | null;
};

function hawaiiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readableReason(reason: string | null | undefined) {
  if (!reason) {
    return "The gate code is not available yet. Confirm the request date, gate hours, and proximity requirements.";
  }

  return reason
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

export default function MobileGateCode() {
  const [request, setRequest] = useState<EligibleRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage("");

    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please sign in to view gate access.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("daily_access_requests")
      .select(
        "id,gate_id,request_date,status,access_accounts!inner(profile_id),gates(name)",
      )
      .eq("access_accounts.profile_id", user.id)
      .eq("request_date", hawaiiToday())
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
    } else {
      setRequest(data as EligibleRequest | null);
    }

    setLoading(false);
  }

  async function reveal() {
    if (!request) {
      return;
    }

    setRevealing(true);
    setMessage("");

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any).rpc(
      "reveal_gate_code_for_request",
      {
        p_request_id: request.id,
        p_gate_id: request.gate_id,

        // A normal web browser cannot verify an iBeacon directly.
        // The backend remains responsible for applying the gate's
        // proximity requirement and any authorized role bypass.
        p_beacon_verified: false,
      },
    );

    const row = (
      Array.isArray(data) ? data[0] : data
    ) as GateCodeRevealRow | null;

    if (error) {
      setMessage(error.message);
      setRevealing(false);
      return;
    }

    if (!row || row.can_reveal !== true || !row.code) {
      setMessage(readableReason(row?.reason));
      setRevealing(false);
      return;
    }

    setCode(row.code);

    const gateName =
      row.gate_name?.trim() ||
      request.gates?.name?.trim() ||
      "Unknown Gate";

    const { error: logError } = await (supabase as any).rpc(
      "log_gate_code_reveal",
      {
        p_request_id: request.id,
        p_gate_name: gateName,
      },
    );

    if (logError) {
      console.error("Unable to log gate-code reveal:", logError);
      setMessage(
        "The gate code was revealed, but the activity log could not be confirmed.",
      );
    }

    setRevealing(false);
  }

  if (loading) {
    return (
      <Card title="Gate Code">
        <p className="muted-text">Checking today’s approved access…</p>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card title="No Eligible Access">
        <StatusBadge label="Unavailable" tone="gray" />

        <p className="muted-text">
          An approved request for today is required.
        </p>

        <Link href="/mobile/requests" className="button secondary">
          View Requests
        </Link>

        {message && <p className="form-error">{message}</p>}
      </Card>
    );
  }

  return (
    <Card
      title={request.gates?.name || "Today’s Gate"}
      subtitle="Approved access"
    >
      <StatusBadge label="Approved" tone="green" />

      <p className="mobile-security-note">
        Gate combinations are for authorized users only. Screenshot activity
        may be logged.
      </p>

      {code ? (
        <div className="mobile-gate-code" aria-label="Gate combination">
          {code}
        </div>
      ) : (
        <button
          className="mobile-reveal-button"
          type="button"
          onClick={reveal}
          disabled={revealing}
        >
          {revealing ? "Checking…" : "Reveal Gate Code"}
        </button>
      )}

      {message && <p className="form-error">{message}</p>}
    </Card>
  );
}
