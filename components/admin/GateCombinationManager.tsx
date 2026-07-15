"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";
import GateAnalytics from "./GateAnalytics";

type GateTone = "green" | "yellow" | "red";

type GateManagerRow = {
  gate_id: string;
  gate_name: string;
  gate_status: string | null;
  road_condition: string | null;
  public_note: string | null;
  today_combination: string | null;
  next_combination: string | null;
  next_combination_date: string | null;
  ibeacon_required: boolean | null;
  ibeacon_disabled_reason: string | null;
};

type GateFormState = {
  date: string;
  combination: string;
  gateStatus: string;
  notes: string;
};

type SharePointGateCodePayload = {
  gateName: string;
  gateId: string;
  comboId: string;
  code: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  gateStatus: string;
  publicNote: string;
  updatedBy?: string | null;
};

function statusTone(status: string | null): GateTone {
  switch ((status || "").toLowerCase()) {
    case "open":
      return "green";
    case "restricted":
      return "yellow";
    case "closed":
      return "red";
    default:
      return "yellow";
  }
}

function statusLabel(status: string | null): string {
  if (!status) return "Restricted";

  switch (status.toLowerCase()) {
    case "open":
      return "Open";
    case "restricted":
      return "Restricted";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function gateHoursLabel(gateName: string | null): string {
  const normalizedName = (gateName || "").toLowerCase();

  if (normalizedName.includes("ʻāinapō") || normalizedName.includes("ainapo")) {
    return "Hours: 4:30 AM – 8:30 PM";
  }

  if (
    normalizedName.includes("honanui") ||
    normalizedName.includes("wood valley")
  ) {
    return "Hours: 6:00 AM – 6:00 PM";
  }

  return "Hours not set";
}

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function syncGateCodeUpdateToSharePoint(
  payload: SharePointGateCodePayload
) {
  const response = await fetch("/api/admin/sharepoint/gate-route-update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
      source: "Kapapala Access Portal",
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    console.error("SharePoint reverse bridge failed:", result);

    throw new Error(
      result?.error ||
        result?.details ||
        "Gate code saved in the app, but SharePoint sync failed."
    );
  }

  return result;
}

export default function GateCombinationManager() {
  const [gates, setGates] = useState<GateManagerRow[]>([]);
  const [forms, setForms] = useState<Record<string, GateFormState>>({});
  const [loading, setLoading] = useState(true);
  const [savingGateId, setSavingGateId] = useState<string | null>(null);
  const [savingIBeaconGateId, setSavingIBeaconGateId] = useState<string | null>(
    null
  );
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [messageByGate, setMessageByGate] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGateManager();
  }, []);

  async function loadGateManager() {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseClient();

    const { data, error: rpcError } = await (supabase as any).rpc(
      "get_admin_gate_combination_manager"
    );

    if (rpcError) {
      console.error("Gate manager load failed:", rpcError);
      setError(rpcError.message || "Unable to load gate combinations.");
      setLoading(false);
      return;
    }

    const rows = ((data || []) as GateManagerRow[]).map((row) => ({
      ...row,
      ibeacon_required: row.ibeacon_required ?? true,
      ibeacon_disabled_reason: row.ibeacon_disabled_reason ?? null,
    }));

    const nextForms: Record<string, GateFormState> = {};

    rows.forEach((gate) => {
      nextForms[gate.gate_id] = {
        date: gate.next_combination_date || todayDateString(),
        combination: gate.next_combination || "",
        gateStatus: statusLabel(gate.gate_status),
        notes: gate.public_note || "",
      };
    });

    setGates(rows);
    setForms(nextForms);

    setSelectedGateId((current) =>
      current && rows.some((gate) => gate.gate_id === current)
        ? current
        : null
    );

    setLoading(false);
  }

  function updateForm(
    gateId: string,
    field: keyof GateFormState,
    value: string
  ) {
    setForms((current) => ({
      ...current,
      [gateId]: {
        ...(current[gateId] || {
          date: todayDateString(),
          combination: "",
          gateStatus: "Restricted",
          notes: "",
        }),
        [field]: value,
      },
    }));
  }

  async function saveGate(gate: GateManagerRow) {
    const form = forms[gate.gate_id];

    if (!form) return;

    if (!form.date) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "Please select a date.",
      }));
      return;
    }

    if (!form.combination.trim()) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "Please enter a gate combination.",
      }));
      return;
    }

    setSavingGateId(gate.gate_id);
    setMessageByGate((current) => ({
      ...current,
      [gate.gate_id]: "",
    }));

    const supabase = getSupabaseClient();

    try {
      const {
        data: { user },
      } = await (supabase as any).auth.getUser();

      const { data: savedData, error: saveError } = await (supabase as any).rpc(
        "admin_save_gate_combination_manager_card",
        {
          p_gate_id: gate.gate_id,
          p_combination: form.combination.trim(),
          p_combination_date: form.date,
          p_gate_status: form.gateStatus.toLowerCase(),
          p_public_note: form.notes.trim(),
        }
      );

      if (saveError) {
        console.error("Gate save failed:", saveError);

        setMessageByGate((current) => ({
          ...current,
          [gate.gate_id]: `Save failed: ${saveError.message}`,
        }));

        return;
      }

      const savedRow = Array.isArray(savedData) ? savedData[0] : savedData;

      const comboId =
        savedRow?.combo_id ||
        savedRow?.combination_id ||
        savedRow?.id ||
        `${gate.gate_id}-${form.date}`;

      try {
        await syncGateCodeUpdateToSharePoint({
          gateName: gate.gate_name || "Unnamed Gate",
          gateId: gate.gate_id,
          comboId,
          code: form.combination.trim(),
          validFrom: form.date,
          validUntil: form.date,
          isActive: true,
          gateStatus: form.gateStatus.toLowerCase(),
          publicNote: form.notes.trim(),
          updatedBy: user?.id ?? null,
        });

        setMessageByGate((current) => ({
          ...current,
          [gate.gate_id]: "Saved and synced to SharePoint.",
        }));
      } catch (syncError) {
        console.error("SharePoint sync failed:", syncError);

        setMessageByGate((current) => ({
          ...current,
          [gate.gate_id]:
            syncError instanceof Error
              ? syncError.message
              : "Saved in the app, but SharePoint sync failed.",
        }));
      }

      await loadGateManager();
    } catch (saveError) {
      console.error("Gate save failed:", saveError);

      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save gate.",
      }));
    } finally {
      setSavingGateId(null);
    }
  }

  async function toggleIBeaconRequirement(gate: GateManagerRow) {
    const currentlyRequired = gate.ibeacon_required ?? true;
    const nextRequired = !currentlyRequired;

    let reason: string | null = null;

    if (!nextRequired) {
      reason = window.prompt(
        "Reason for disabling iBeacon requirement? Example: Beacon malfunction"
      );

      if (!reason?.trim()) return;
    }

    setSavingIBeaconGateId(gate.gate_id);
    setMessageByGate((current) => ({
      ...current,
      [gate.gate_id]: "",
    }));

    const supabase = getSupabaseClient();

    try {
      const { error: rpcError } = await (supabase as any).rpc(
        "admin_set_gate_ibeacon_requirement",
        {
          p_gate_id: gate.gate_id,
          p_ibeacon_required: nextRequired,
          p_reason: reason,
        }
      );

      if (rpcError) {
        console.error("iBeacon requirement update failed:", rpcError);

        setMessageByGate((current) => ({
          ...current,
          [gate.gate_id]: `iBeacon update failed: ${rpcError.message}`,
        }));

        return;
      }

      setGates((current) =>
        current.map((currentGate) =>
          currentGate.gate_id === gate.gate_id
            ? {
                ...currentGate,
                ibeacon_required: nextRequired,
                ibeacon_disabled_reason: nextRequired
                  ? null
                  : reason?.trim() || null,
              }
            : currentGate
        )
      );

      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: nextRequired
          ? "iBeacon requirement enabled."
          : "iBeacon requirement disabled for this gate.",
      }));
    } catch (ibeaconError) {
      console.error("iBeacon requirement update failed:", ibeaconError);

      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]:
          ibeaconError instanceof Error
            ? ibeaconError.message
            : "Unable to update iBeacon requirement.",
      }));
    } finally {
      setSavingIBeaconGateId(null);
    }
  }

  if (loading) {
    return (
      <Card
        title="Gate Combinations"
        className="admin-inner-card admin-queue-card"
      >
        <p>Loading gate combinations...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="Gate Combinations"
        className="admin-inner-card admin-queue-card"
      >
        <p>Unable to load gate combinations.</p>
        <p>{error}</p>
      </Card>
    );
  }

  if (!gates.length) {
    return (
      <Card
        title="Gate Combinations"
        className="admin-inner-card admin-queue-card"
      >
        <p>No active gates were found.</p>
      </Card>
    );
  }

  const selectedGate =
    gates.find((gate) => gate.gate_id === selectedGateId) || null;

  const selectedForm = selectedGate
    ? forms[selectedGate.gate_id]
    : undefined;

  return (
    <div className="gate-manager-layout">
      <div className="gate-manager-grid">
        {gates.map((gate) => {
          const ibeaconRequired = gate.ibeacon_required ?? true;
          const isSavingIBeacon = savingIBeaconGateId === gate.gate_id;
          const isSelected = selectedGateId === gate.gate_id;

          return (
            <Card
              key={gate.gate_id}
              title={gate.gate_name || "Unnamed Gate"}
              className={[
                "gate-manager-card",
                `gate-manager-card--${statusTone(gate.gate_status)}`,
                isSelected ? "gate-manager-card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="gate-manager-header">
                <StatusBadge
                  label={statusLabel(gate.gate_status)}
                  tone={statusTone(gate.gate_status)}
                />

                <span>{gateHoursLabel(gate.gate_name)}</span>
              </div>

              <div className="gate-manager-summary">
                <div className="combo-box combo-box--combination">
                  <span>Today&apos;s Combination</span>
                  <strong>{gate.today_combination || "—"}</strong>
                </div>

                <div className="combo-box combo-box--ibeacon">
                  <span>iBeacon Requirement</span>

                  <strong>{ibeaconRequired ? "Required" : "Bypassed"}</strong>

                  <p className="muted">
                    {ibeaconRequired
                      ? "Proximity verification is required."
                      : gate.ibeacon_disabled_reason
                        ? `Bypass reason: ${gate.ibeacon_disabled_reason}`
                        : "Proximity verification is bypassed."}
                  </p>

                  <button
                    type="button"
                    className={
                      ibeaconRequired ? "button warning" : "button secondary"
                    }
                    onClick={() => void toggleIBeaconRequirement(gate)}
                    disabled={isSavingIBeacon}
                  >
                    {isSavingIBeacon
                      ? "Saving..."
                      : ibeaconRequired
                        ? "Disable iBeacon Requirement"
                        : "Enable iBeacon Requirement"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="gate-manager-edit-button"
                aria-expanded={isSelected}
                onClick={() =>
                  setSelectedGateId((current) =>
                    current === gate.gate_id ? null : gate.gate_id
                  )
                }
              >
                <span>
                  <strong>
                    {isSelected ? "Editing gate settings" : "Update gate settings"}
                  </strong>
                  <small>Combination, status, date, and public notice</small>
                </span>

                <span
                  className="gate-manager-edit-button__icon"
                  aria-hidden="true"
                >
                  {isSelected ? "×" : "→"}
                </span>
              </button>
            </Card>
          );
        })}
      </div>

      {selectedGate && selectedForm && (
        <section className="gate-manager-editor">
          <div className="gate-manager-editor__header">
            <div>
              <span className="gate-manager-editor__eyebrow">
                Gate configuration
              </span>

              <h3>{selectedGate.gate_name || "Unnamed Gate"}</h3>

              <p>
                Update the next combination, gate status, effective date, and
                public-facing notice.
              </p>
            </div>

            <button
              type="button"
              className="gate-manager-editor__close"
              aria-label="Close gate settings"
              onClick={() => setSelectedGateId(null)}
            >
              ×
            </button>
          </div>

          <form
            className="gate-manager-editor__form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveGate(selectedGate);
            }}
          >
            <label>
              Date
              <input
                type="date"
                value={selectedForm.date}
                onChange={(event) =>
                  updateForm(
                    selectedGate.gate_id,
                    "date",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Combination
              <input
                value={selectedForm.combination}
                onChange={(event) =>
                  updateForm(
                    selectedGate.gate_id,
                    "combination",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Gate Status
              <select
                value={selectedForm.gateStatus}
                onChange={(event) =>
                  updateForm(
                    selectedGate.gate_id,
                    "gateStatus",
                    event.target.value
                  )
                }
              >
                <option value="Open">Open</option>
                <option value="Restricted">Restricted</option>
                <option value="Closed">Closed</option>
              </select>
            </label>

            <label className="gate-manager-editor__note">
              Public Note
              <textarea
                value={selectedForm.notes}
                onChange={(event) =>
                  updateForm(
                    selectedGate.gate_id,
                    "notes",
                    event.target.value
                  )
                }
              />
            </label>

            <div className="gate-manager-editor__actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setSelectedGateId(null)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button primary"
                disabled={savingGateId === selectedGate.gate_id}
              >
                {savingGateId === selectedGate.gate_id
                  ? "Saving..."
                  : "Save Gate Combination"}
              </button>
            </div>

            {messageByGate[selectedGate.gate_id] ? (
              <p className="form-message gate-manager-editor__message">
                {messageByGate[selectedGate.gate_id]}
              </p>
            ) : null}
          </form>
        </section>
      )}

      <GateAnalytics />
    </div>
  );
}
