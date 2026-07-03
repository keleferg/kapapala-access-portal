"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "denied" | string;

type Gate = {
  id: string;
  name: string | null;
};

type AccessRequest = {
  id: string;
  access_account_id: string;
  gate_id: string | null;
  request_date: string;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  status: RequestStatus;
  pending_reason: string | null;
  created_at: string;

  gates: {
    name: string | null;
  } | null;

  access_accounts: {
    id: string;
    profile_id: string | null;
  } | null;
};

type EditAccessRequestFormProps = {
  requestId: string;
};

function formatStatus(status: RequestStatus) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: RequestStatus): "green" | "yellow" | "red" {
  if (status === "approved") return "green";
  if (status === "denied") return "red";
  return "yellow";
}

function normalizeDateValue(dateValue: string | null) {
  if (!dateValue) return "";
  return dateValue.slice(0, 10);
}

export default function EditAccessRequestForm({
  requestId,
}: EditAccessRequestFormProps) {
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [requestDate, setRequestDate] = useState("");
  const [gateId, setGateId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [vehicleSummary, setVehicleSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    return request?.status === "pending" && Boolean(request?.pending_reason);
  }, [request]);

  useEffect(() => {
    void loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function loadFormData() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be signed in to edit this request.");
      setLoading(false);
      return;
    }

    const { data: requestData, error: requestError } = await (supabase as any)
      .from("daily_access_requests")
      .select(`
        id,
        access_account_id,
        gate_id,
        request_date,
        purpose,
        party_size,
        vehicle_summary,
        status,
        pending_reason,
        created_at,
        gates (
          name
        ),
        access_accounts!inner (
          id,
          profile_id
        )
      `)
      .eq("id", requestId)
      .eq("access_accounts.profile_id", user.id)
      .single();

    if (requestError) {
      console.error("Unable to load access request:", requestError);
      setErrorMessage(
        requestError.message || "Unable to load this access request."
      );
      setLoading(false);
      return;
    }

    const { data: gatesData, error: gatesError } = await (supabase as any)
      .from("gates")
      .select("id, name")
      .order("name", { ascending: true });

    if (gatesError) {
      console.error("Unable to load gates:", gatesError);
      setErrorMessage(gatesError.message || "Unable to load gates.");
      setLoading(false);
      return;
    }

    const loadedRequest = requestData as AccessRequest;

    setRequest(loadedRequest);
    setGates((gatesData ?? []) as Gate[]);
    setRequestDate(normalizeDateValue(loadedRequest.request_date));
    setGateId(loadedRequest.gate_id ?? "");
    setPurpose(loadedRequest.purpose ?? "");
    setPartySize(String(loadedRequest.party_size ?? 1));
    setVehicleSummary(loadedRequest.vehicle_summary ?? "");
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request) return;

    if (!canEdit) {
      alert("This request cannot be edited.");
      return;
    }

    if (!requestDate) {
      alert("Please select a request date.");
      return;
    }

    if (!gateId) {
      alert("Please select a gate.");
      return;
    }

    const parsedPartySize = Number(partySize);

    if (!Number.isFinite(parsedPartySize) || parsedPartySize < 1) {
      alert("Please enter a valid party size.");
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase as any)
        .from("daily_access_requests")
        .update({
          request_date: requestDate,
          gate_id: gateId,
          purpose: purpose.trim() || null,
          party_size: parsedPartySize,
          vehicle_summary: vehicleSummary.trim() || null,
        })
        .eq("id", request.id);

      if (error) {
        console.error("Unable to update access request:", error);
        alert(error.message || "Unable to update this request.");
        return;
      }

      window.location.href = "/my-access-requests";
    } catch (error) {
      console.error("Unable to update access request:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update this request."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
  return (
    <Card title="Loading Request...">
      <p className="text-sm text-gray-600">Please wait...</p>
    </Card>
  );
}

  if (errorMessage || !request) {
    return (
      <Card title="Unable to Edit Request">
        <div className="space-y-4">
          <p className="text-sm text-red-700">
            {errorMessage || "This request could not be loaded."}
          </p>

          <Link className="button secondary" href="/my-access-requests">
            Back to My Access Requests
          </Link>
        </div>
      </Card>
    );
  }

  if (!canEdit) {
    return (
      <Card title="Request Cannot Be Edited">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge
              label={formatStatus(request.status)}
              tone={statusTone(request.status)}
            />
          </div>

          <p className="text-sm text-gray-600">
            This request can only be edited while it is pending with a pending
            reason.
          </p>

          <Link className="button secondary" href="/my-access-requests">
            Back to My Access Requests
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500">
              Pending Request
            </div>

            <h3 className="mt-1 text-xl font-semibold text-gray-900">
              Edit Request
            </h3>

            {request.pending_reason && (
              <div className="pending-reason mt-3">
                <strong>Pending reason:</strong> {request.pending_reason}
              </div>
            )}
          </div>

          <StatusBadge
            label={formatStatus(request.status)}
            tone={statusTone(request.status)}
          />
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Request Date</span>
            <input
              type="date"
              value={requestDate}
              onChange={(event) => setRequestDate(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Gate</span>
            <select
              value={gateId}
              onChange={(event) => setGateId(event.target.value)}
              required
            >
              <option value="">Select a gate</option>
              {gates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.name || "Unnamed Gate"}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Party Size</span>
            <input
              type="number"
              min="1"
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Vehicle</span>
            <input
              type="text"
              value={vehicleSummary}
              onChange={(event) => setVehicleSummary(event.target.value)}
              placeholder="Example: White Toyota Tacoma"
            />
          </label>
        </div>

        <label className="field">
          <span>Purpose</span>
          <textarea
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="Briefly describe the purpose of your access request."
            rows={4}
          />
        </label>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <Link className="button secondary" href="/my-access-requests">
            Cancel
          </Link>

          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}