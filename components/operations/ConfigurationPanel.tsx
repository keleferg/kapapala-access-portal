"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { configurationItems } from "../../lib/operationsConfig";
import { getSupabaseClient } from "../../lib/supabaseClient";

type GateConfigurationRow = {
  gate_id: string;
  gate_name: string;
  gate_status: string | null;
  open_time: string | null;
  close_time: string | null;
  ibeacon_required: boolean | null;
  ibeacon_uuid: string | null;
  ibeacon_major: number | null;
  ibeacon_minor: number | null;
  ibeacon_note: string | null;
};

type GateConfigurationForm = {
  ibeaconRequired: boolean;
  ibeaconUuid: string;
  ibeaconMajor: string;
  ibeaconMinor: string;
  ibeaconNote: string;
};

function formatTime(value: string | null): string {
  if (!value) return "Not set";

  const parts = value.split(":");
  if (parts.length < 2) return value;

  const hour = Number(parts[0]);
  const minute = parts[1];

  if (Number.isNaN(hour)) return value;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${displayHour}:${minute} ${period}`;
}

function statusTone(status: string | null): "green" | "yellow" | "red" {
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

function isValidUuid(value: string): boolean {
  if (!value.trim()) return true;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function isValidBeaconNumber(value: string): boolean {
  if (!value.trim()) return true;

  const numberValue = Number(value);

  return (
    Number.isInteger(numberValue) &&
    numberValue >= 0 &&
    numberValue <= 65535
  );
}

export default function ConfigurationPanel() {
  const [gates, setGates] = useState<GateConfigurationRow[]>([]);
  const [forms, setForms] = useState<Record<string, GateConfigurationForm>>({});
  const [loading, setLoading] = useState(true);
  const [savingGateId, setSavingGateId] = useState<string | null>(null);
  const [messageByGate, setMessageByGate] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGateConfiguration();
  }, []);

  async function loadGateConfiguration() {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseClient();

    const { data, error: rpcError } = await (supabase as any).rpc(
      "get_admin_gate_configuration"
    );

    if (rpcError) {
      console.error("Gate configuration load failed:", rpcError);
      setError(rpcError.message || "Unable to load gate configuration.");
      setLoading(false);
      return;
    }

    const rows = (data || []) as GateConfigurationRow[];
    const nextForms: Record<string, GateConfigurationForm> = {};

    rows.forEach((gate) => {
      nextForms[gate.gate_id] = {
        ibeaconRequired: gate.ibeacon_required ?? true,
        ibeaconUuid: gate.ibeacon_uuid ?? "",
        ibeaconMajor:
          gate.ibeacon_major === null || gate.ibeacon_major === undefined
            ? ""
            : String(gate.ibeacon_major),
        ibeaconMinor:
          gate.ibeacon_minor === null || gate.ibeacon_minor === undefined
            ? ""
            : String(gate.ibeacon_minor),
        ibeaconNote: gate.ibeacon_note ?? "",
      };
    });

    setGates(rows);
    setForms(nextForms);
    setLoading(false);
  }

  function updateGateForm<K extends keyof GateConfigurationForm>(
    gateId: string,
    field: K,
    value: GateConfigurationForm[K]
  ) {
    setForms((current) => ({
      ...current,
      [gateId]: {
        ...(current[gateId] || {
          ibeaconRequired: true,
          ibeaconUuid: "",
          ibeaconMajor: "",
          ibeaconMinor: "",
          ibeaconNote: "",
        }),
        [field]: value,
      },
    }));
  }

  async function saveGateConfiguration(gate: GateConfigurationRow) {
    const form = forms[gate.gate_id];

    if (!form) return;

    const cleanedUuid = form.ibeaconUuid.trim();
    const cleanedMajor = form.ibeaconMajor.trim();
    const cleanedMinor = form.ibeaconMinor.trim();
    const cleanedNote = form.ibeaconNote.trim();

    if (!isValidUuid(cleanedUuid)) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "Please enter a valid iBeacon UUID.",
      }));
      return;
    }

    if (!isValidBeaconNumber(cleanedMajor)) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "Major must be a whole number between 0 and 65535.",
      }));
      return;
    }

    if (!isValidBeaconNumber(cleanedMinor)) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "Minor must be a whole number between 0 and 65535.",
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
      const { error: rpcError } = await (supabase as any).rpc(
        "admin_update_gate_ibeacon_config",
        {
          p_gate_id: gate.gate_id,
          p_ibeacon_required: form.ibeaconRequired,
          p_ibeacon_uuid: cleanedUuid || null,
          p_ibeacon_major: cleanedMajor ? Number(cleanedMajor) : null,
          p_ibeacon_minor: cleanedMinor ? Number(cleanedMinor) : null,
          p_ibeacon_note: cleanedNote || null,
        }
      );

      if (rpcError) {
        console.error("Gate iBeacon configuration save failed:", rpcError);

        setMessageByGate((current) => ({
          ...current,
          [gate.gate_id]: `Save failed: ${rpcError.message}`,
        }));

        return;
      }

      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: "iBeacon configuration saved.",
      }));

      await loadGateConfiguration();
    } catch (error) {
      console.error("Gate iBeacon configuration save failed:", error);

      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]:
          error instanceof Error
            ? error.message
            : "Unable to save iBeacon configuration.",
      }));
    } finally {
      setSavingGateId(null);
    }
  }

  return (
    <div className="configuration-stack">
      <Card title="Configuration Management">
        <p className="muted-text">
          System values that change over time should be editable by authorized
          administrators instead of hard-coded into the application.
        </p>

        <div className="configuration-table">
          <div>
            <strong>Group</strong>
            <strong>Item</strong>
            <strong>Current Value</strong>
            <strong>Status</strong>
          </div>

          {configurationItems.map((item) => (
            <div key={`${item.group}-${item.item}`}>
              <span>{item.group}</span>
              <span>{item.item}</span>
              <span>{item.value}</span>
              <StatusBadge label="Configurable" tone="green" />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Gate iBeacon Configuration">
        <p className="muted-text">
          Configure the physical iBeacon assigned to each gate. Emergency bypass
          remains in the Gate Combination Manager.
        </p>

        {loading ? (
          <p>Loading gate configuration...</p>
        ) : error ? (
          <div>
            <p>Unable to load gate configuration.</p>
            <p className="form-message">{error}</p>
          </div>
        ) : gates.length === 0 ? (
          <p>No active gates were found.</p>
        ) : (
          <div className="ibeacon-config-grid">
            {gates.map((gate) => {
              const form = forms[gate.gate_id];
              const saving = savingGateId === gate.gate_id;

              return (
                <form
                  className="ibeacon-config-card"
                  key={gate.gate_id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveGateConfiguration(gate);
                  }}
                >
                  <div className="ibeacon-config-header">
                    <div>
                      <h3>{gate.gate_name || "Unnamed Gate"}</h3>
                      <p>
                        Hours: {formatTime(gate.open_time)} –{" "}
                        {formatTime(gate.close_time)}
                      </p>
                    </div>

                    <StatusBadge
                      label={statusLabel(gate.gate_status)}
                      tone={statusTone(gate.gate_status)}
                    />
                  </div>

                  <label className="ibeacon-check-row">
                    <input
                      type="checkbox"
                      checked={form?.ibeaconRequired ?? true}
                      onChange={(event) =>
                        updateGateForm(
                          gate.gate_id,
                          "ibeaconRequired",
                          event.target.checked
                        )
                      }
                    />
                    <span>Require iBeacon for code reveal</span>
                  </label>

                  <label className="ibeacon-field">
                    <span>iBeacon UUID</span>
                    <input
                      value={form?.ibeaconUuid || ""}
                      placeholder="AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
                      onChange={(event) =>
                        updateGateForm(
                          gate.gate_id,
                          "ibeaconUuid",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="ibeacon-two-col">
                    <label className="ibeacon-field">
                      <span>Major</span>
                      <input
                        inputMode="numeric"
                        value={form?.ibeaconMajor || ""}
                        placeholder="1"
                        onChange={(event) =>
                          updateGateForm(
                            gate.gate_id,
                            "ibeaconMajor",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="ibeacon-field">
                      <span>Minor</span>
                      <input
                        inputMode="numeric"
                        value={form?.ibeaconMinor || ""}
                        placeholder="1"
                        onChange={(event) =>
                          updateGateForm(
                            gate.gate_id,
                            "ibeaconMinor",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label className="ibeacon-field">
                    <span>Install Note</span>
                    <textarea
                      rows={2}
                      value={form?.ibeaconNote || ""}
                      placeholder="Example: Mounted near keypad."
                      onChange={(event) =>
                        updateGateForm(
                          gate.gate_id,
                          "ibeaconNote",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="ibeacon-actions">
                    <button
                      type="submit"
                      className="button primary"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Configuration"}
                    </button>
                  </div>

                  {messageByGate[gate.gate_id] ? (
                    <p className="form-message compact-message">
                      {messageByGate[gate.gate_id]}
                    </p>
                  ) : null}
                </form>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
