"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";
import Link from "next/link";

type Gate = {
  id: string;
  name: string;
  status: string;
  road_condition: string | null;
  notes: string | null;
};

type Vehicle = {
  id: string;
  label: string;
  license_plate: string;
  state: string | null;
  is_default: boolean;
};

type AccessAccount = {
  id: string;
  access_id: string | null;
  status: string;
  default_gate: string | null;
  emergency_contact_phone: string | null;
  organization: string | null;
  vehicles: Vehicle[];
};

const purposes = [
  "Hiking",
  "Cabin",
  "Mauna Loa",
  "Hunting",
  "Recreation",
  "Cultural Gathering",
  "Photography",
  "Other",
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function gateTone(status: string): "green" | "yellow" | "red" {
  if (status === "open") return "green";
  if (status === "restricted") return "yellow";
  return "red";
}

function buildVehicleSummary(
  account: AccessAccount,
  selectedVehicleIds: string[],
  additionalVehicles: string
) {
  const savedVehicles = selectedVehicleIds
    .map((id) => account.vehicles.find((vehicle) => vehicle.id === id))
    .filter(Boolean)
    .map(
      (vehicle) =>
        `${vehicle!.label} • ${vehicle!.state || "HI"} ${vehicle!.license_plate}`
    );

  return [...savedVehicles, additionalVehicles.trim()]
    .filter(Boolean)
    .join("; ");
}

export default function DailyAccessRequestWizard() {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [account, setAccount] = useState<AccessAccount | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");

  const now = new Date();
  const afterCutoff = now.getHours() >= 22;

  const earliestDate = useMemo(
    () => addDays(new Date(), afterCutoff ? 2 : 1),
    [afterCutoff]
  );

  const maxDate = useMemo(() => addDays(new Date(), 90), []);

  const [dateMode, setDateMode] = useState<"earliest" | "custom">("earliest");
  const [requestDate, setRequestDate] = useState(
    toDateInputValue(earliestDate)
  );

  const [gateId, setGateId] = useState("");
  const [purpose, setPurpose] = useState("Hiking");
  const [otherPurpose, setOtherPurpose] = useState("");
  const [persons, setPersons] = useState(1);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [additionalVehicles, setAdditionalVehicles] = useState("");
  const [permitNumber, setPermitNumber] = useState("");

  useEffect(() => {
    setRequestDate(toDateInputValue(earliestDate));
  }, [earliestDate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        const user = userData.user;

        if (!user) {
          setError("Please sign in before requesting access.");
          return;
        }

        const { data: accountData, error: accountError } = await supabase
          .from("access_accounts")
          .select(
            `
            id,
            access_id,
            status,
            default_gate,
            emergency_contact_phone,
            organization,
            vehicles (
              id,
              label,
              license_plate,
              state,
              is_default
            )
          `
          )
          .eq("profile_id", user.id)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        const { data: gateData, error: gateError } = await supabase
          .from("gates")
          .select("id, name, status, road_condition, notes")
          .eq("active", true)
          .order("name", { ascending: true });

        if (gateError) {
          throw gateError;
        }

        const typedAccount = accountData as AccessAccount | null;
        const typedGates = (gateData ?? []) as Gate[];

        setAccount(typedAccount);
        setGates(typedGates);

        if (typedAccount?.default_gate) {
          const defaultGate = typedGates.find(
            (gate) => gate.name === typedAccount.default_gate
          );

          if (defaultGate) {
            setGateId(defaultGate.id);
          }
        }

        const defaultVehicle = typedAccount?.vehicles?.find(
          (vehicle) => vehicle.is_default
        );

        if (defaultVehicle) {
          setSelectedVehicleIds([defaultVehicle.id]);
        } else if (typedAccount?.vehicles?.[0]) {
          setSelectedVehicleIds([typedAccount.vehicles[0].id]);
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to load access request."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  async function submitRequest() {
    if (!account) {
      alert("No access account found.");
      return;
    }

    if (account.status !== "active") {
      alert("Your access account must be active before requesting access.");
      return;
    }

    if (!gateId) {
      alert("Select a gate.");
      return;
    }

    const selectedGate = gates.find((gate) => gate.id === gateId);

    if (!selectedGate || selectedGate.status === "closed") {
      alert("This gate is not currently available.");
      return;
    }

    if (persons < 1) {
      alert("Number of persons must be at least 1.");
      return;
    }

    const finalPurpose =
      purpose === "Other" ? otherPurpose.trim() || "Other" : purpose;

    if (
      (purpose === "Cabin" || purpose === "Mauna Loa") &&
      !permitNumber.trim()
    ) {
      alert("Permit number is required for Cabin or Mauna Loa access.");
      return;
    }

    const vehicleSummary = buildVehicleSummary(
      account,
      selectedVehicleIds,
      additionalVehicles
    );

    if (!vehicleSummary) {
      alert("Select or enter at least one vehicle.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await (supabase as any)
        .from("daily_access_requests")
        .insert({
          access_account_id: account.id,
          request_date: requestDate,
          gate_id: gateId,
          purpose: finalPurpose,
          party_size: persons,
          vehicle_summary: vehicleSummary,
          emergency_contact_phone: account.emergency_contact_phone,
          summit_permit_number: permitNumber.trim() || null,
          organization: account.organization,
          status: "pending",
          admin_notes: null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setSuccessId(data.id);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to submit request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedVehicleLabels = selectedVehicleIds
    .map((id) => account?.vehicles?.find((vehicle) => vehicle.id === id)?.label)
    .filter(Boolean);

  const reviewVehicleText = [
    ...selectedVehicleLabels,
    additionalVehicles.trim() ? "Additional vehicle(s) entered" : "",
  ]
    .filter(Boolean)
    .join(", ");

  if (loading) {
    return <p className="muted-text">Loading access request...</p>;
  }

  if (successId) {
    return (
      <div className="mobile-request-page">
        <Card title="Request Submitted">
          <div className="approval-preview">
            <div className="approval-icon">✅</div>
            <div>
              <h2>Access request received.</h2>
              <p>
                A confirmation has been recorded. Gate information will be sent
                according to the approved gate delivery schedule.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mobile-request-page">
      <div className="request-hero-card">
        <div>
          <p className="eyebrow">Daily Access Request</p>
          <h2>Request Forest Reserve Access</h2>
          <p>
            Requests must be submitted by 10:00 PM the evening before entry.
            Access may be requested up to 90 days in advance.
          </p>
        </div>

        <StatusBadge
          label={account?.status ? account.status : "No Account"}
          tone={account?.status === "active" ? "green" : "yellow"}
        />
      </div>

      {error && (
        <Card title="Unable to Continue">
          <p className="muted-text">{error}</p>
        </Card>
      )}

      {!error && (
        <div className="request-layout">
          <div className="mobile-form-stack">
            <Card title="1. Access Date">
              {afterCutoff && (
                <div className="conditional-note">
                  Tomorrow&apos;s requests are closed. The next available date is{" "}
                  <strong>
                    {formatDisplayDate(toDateInputValue(earliestDate))}
                  </strong>
                  .
                </div>
              )}

              <div className="choice-grid two">
                <button
                  className={`choice-card ${
                    dateMode === "earliest" ? "selected" : ""
                  }`}
                  type="button"
                  onClick={() => {
                    setDateMode("earliest");
                    setRequestDate(toDateInputValue(earliestDate));
                  }}
                >
                  {afterCutoff ? "Next Available Date" : "Tomorrow"}
                </button>

                <button
                  className={`choice-card ${
                    dateMode === "custom" ? "selected" : ""
                  }`}
                  type="button"
                  onClick={() => setDateMode("custom")}
                >
                  Another Date
                </button>
              </div>

              {dateMode === "custom" && (
                <label>
                  Select Date
                  <input
                    type="date"
                    min={toDateInputValue(earliestDate)}
                    max={toDateInputValue(maxDate)}
                    value={requestDate}
                    onChange={(event) => setRequestDate(event.target.value)}
                  />
                </label>
              )}

              <p className="muted-text">
                Selected: <strong>{formatDisplayDate(requestDate)}</strong>
              </p>
            </Card>

            <Card title="2. Gate">
              <div className="choice-grid three">
                {gates.map((gate) => (
                  <button
                    key={gate.id}
                    className={`choice-card ${
                      gateId === gate.id ? "selected" : ""
                    }`}
                    type="button"
                    disabled={gate.status === "closed"}
                    onClick={() => setGateId(gate.id)}
                  >
                    <strong>{gate.name}</strong>
                    <br />
                    <StatusBadge
                      label={gate.status}
                      tone={gateTone(gate.status)}
                    />
                    <br />
                    <span>{gate.road_condition || "Road condition pending"}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="3. Purpose">
              <div className="choice-grid two">
                {purposes.map((item) => (
                  <button
                    key={item}
                    className={`choice-card ${
                      purpose === item ? "selected" : ""
                    }`}
                    type="button"
                    onClick={() => setPurpose(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {purpose === "Other" && (
                <label>
                  Other Purpose
                  <input
                    value={otherPurpose}
                    onChange={(event) => setOtherPurpose(event.target.value)}
                    placeholder="Briefly describe your purpose"
                  />
                </label>
              )}

              {(purpose === "Cabin" || purpose === "Mauna Loa") && (
                <label>
                  Permit Number
                  <input
                    value={permitNumber}
                    onChange={(event) => setPermitNumber(event.target.value)}
                    placeholder="Cabin or backcountry permit number"
                  />
                </label>
              )}
            </Card>

            <Card title="4. Party & Vehicles">
              <div className="mobile-form-stack">
                <label>
                  Number of Persons
                  <input
                    type="number"
                    min={1}
                    value={persons}
                    onChange={(event) =>
                      setPersons(Math.max(1, Number(event.target.value)))
                    }
                  />
                </label>

                <label>
                  Registered Vehicle(s)
                  <select
                    multiple
                    value={selectedVehicleIds}
                    onChange={(event) =>
                      setSelectedVehicleIds(
                        Array.from(event.target.selectedOptions).map(
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {account?.vehicles?.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} • {vehicle.state || "HI"}{" "}
                        {vehicle.license_plate}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Additional Vehicle(s)
                  <textarea
                    value={additionalVehicles}
                    onChange={(event) =>
                      setAdditionalVehicles(event.target.value)
                    }
                    placeholder="Enter any additional vehicles, license plates, trailers, ATVs, or UTVs."
                    rows={4}
                  />
                </label>
              </div>
            </Card>
          </div>

          <div>
            <Card title="Review Request">
              <div className="request-summary-grid">
                <div className="summary-item">
                  <span>Date</span>
                  <strong>{formatDisplayDate(requestDate)}</strong>
                </div>

                <div className="summary-item">
                  <span>Gate</span>
                  <strong>
                    {gates.find((gate) => gate.id === gateId)?.name ||
                      "Not selected"}
                  </strong>
                </div>

                <div className="summary-item">
                  <span>Purpose</span>
                  <strong>
                    {purpose === "Other" ? otherPurpose || "Other" : purpose}
                  </strong>
                </div>

                <div className="summary-item">
                  <span>Persons</span>
                  <strong>{persons}</strong>
                </div>

                <div className="summary-item">
                  <span>Vehicles</span>
                  <strong>{reviewVehicleText || "Not selected"}</strong>
                </div>
              </div>

              <button
                className="button primary full-width sticky-submit"
                type="button"
                onClick={submitRequest}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Access Request"}
              </button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}