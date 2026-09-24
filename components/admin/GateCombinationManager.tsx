"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";
import GateAnalytics from "./GateAnalytics";

type GateTone = "green" | "yellow" | "red";


type GateHistoryRow = {
  id: string;
  gate_id: string;
  gate_name: string;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean | null;
  credential_source: string | null;
  created_at: string;
};

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
  code_mode: string | null;
  lock_device_id: string | null;
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
  const [savingCodeModeGateId, setSavingCodeModeGateId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<GateHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyGateId, setHistoryGateId] = useState("all");
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [messageByGate, setMessageByGate] = useState<Record<string, string>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"management" | "history">("management");

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

  async function loadGateHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    const supabase = getSupabaseClient();
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 2);
    const { data, error } = await (supabase as any).rpc("get_admin_gate_code_history", {
      p_gate_id: historyGateId === "all" ? null : historyGateId,
      p_start_date: start.toISOString().slice(0, 10),
      p_end_date: end.toISOString().slice(0, 10),
    });
    if (error) { setHistoryError(error.message); setHistoryRows([]); }
    else setHistoryRows((data || []) as GateHistoryRow[]);
    setHistoryLoading(false);
  }

  async function revealHistoricalCode(row: GateHistoryRow) {
    const supabase = getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("admin_reveal_gate_code_history", { p_combination_id: row.id });
    if (error) { setHistoryError(error.message); return; }
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.combination) setRevealedCodes((current) => ({ ...current, [row.id]: result.combination }));
  }

  async function setGateCodeMode(gate: GateManagerRow, mode: "auto" | "manual") {
    if ((gate.code_mode || "manual") === mode) return;

    setSavingCodeModeGateId(gate.gate_id);
    setMessageByGate((current) => ({ ...current, [gate.gate_id]: "" }));
    const supabase = getSupabaseClient();

    try {
      const { error: rpcError } = await (supabase as any).rpc(
        "admin_set_gate_code_mode",
        { p_gate_id: gate.gate_id, p_code_mode: mode }
      );
      if (rpcError) throw rpcError;
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: mode === "auto"
          ? "Gate code mode set to Auto (Igloohome)."
          : "Gate code mode set to Manual.",
      }));
      await loadGateManager();
    } catch (modeError) {
      setMessageByGate((current) => ({
        ...current,
        [gate.gate_id]: `Code mode update failed: ${modeError instanceof Error ? modeError.message : "Unable to update gate code mode."}`,
      }));
    } finally {
      setSavingCodeModeGateId(null);
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
    <div className="gate-manager-layout">
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem"}}>
        <button type="button" className={activeTab==="management"?"button primary":"button secondary"} onClick={()=>setActiveTab("management")}>Gate Management</button>
        <button type="button" className={activeTab==="history"?"button primary":"button secondary"} onClick={()=>setActiveTab("history")}>Gate History</button>
      </div>

      {activeTab==="management" ? <>
        <section className="gate-manager-editor" style={{marginBottom:"1.25rem"}}>
          <div className="gate-manager-editor__header"><div><span className="gate-manager-editor__eyebrow">Gate Status</span><h3>All Gates</h3><p>Current operating status for all gates.</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"0.75rem"}}>
            {gates.map(gate=><div key={gate.gate_id} className="combo-box"><span>{gate.gate_name}</span><div style={{margin:"0.5rem 0"}}><StatusBadge label={statusLabel(gate.gate_status)} tone={statusTone(gate.gate_status)}/></div><p className="muted">{gateHoursLabel(gate.gate_name)}</p></div>)}
          </div>
        </section>

        <section className="gate-manager-editor" style={{marginBottom:"1.25rem"}}>
          <div className="gate-manager-editor__header"><div><span className="gate-manager-editor__eyebrow">Gate Management</span><h3>Select Gate</h3><p>Select an individual gate to open its management profile.</p></div></div>
          <select value={selectedGateId||""} onChange={e=>setSelectedGateId(e.target.value||null)} style={{width:"100%",maxWidth:"420px"}}>
            <option value="">Select a gate...</option>{gates.map(gate=><option key={gate.gate_id} value={gate.gate_id}>{gate.gate_name}</option>)}
          </select>
        </section>

        {selectedGate && selectedForm ? <>
          <Card title={selectedGate.gate_name||"Unnamed Gate"} className={`gate-manager-card gate-manager-card--${statusTone(selectedGate.gate_status)}`}>
            <div className="gate-manager-header"><StatusBadge label={statusLabel(selectedGate.gate_status)} tone={statusTone(selectedGate.gate_status)}/><span>{gateHoursLabel(selectedGate.gate_name)}</span></div>
            <div className="gate-manager-summary">
              <div className="combo-box combo-box--combination"><span>Today&apos;s Combination</span><strong>{selectedGate.today_combination||"—"}</strong></div>
              <div className="combo-box combo-box--combination"><span>Next Combination</span><strong>{selectedGate.next_combination||"—"}</strong><p className="muted">{selectedGate.next_combination_date?`Effective ${new Date(`${selectedGate.next_combination_date}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:"No future combination scheduled."}</p></div>
              <div className="combo-box combo-box--combination"><span>Gate Code Mode</span><strong>{(selectedGate.code_mode||"manual").toLowerCase()==="auto"?"Auto":"Manual"}</strong><p className="muted">{(selectedGate.code_mode||"manual").toLowerCase()==="auto"?`Igloohome automation is enabled${selectedGate.lock_device_id?` (Device ${selectedGate.lock_device_id})`:""}.`:"Gate combinations are managed manually."}</p><div style={{display:"flex",gap:"0.5rem"}}><button type="button" className={(selectedGate.code_mode||"manual").toLowerCase()==="auto"?"button primary":"button secondary"} onClick={()=>void setGateCodeMode(selectedGate,"auto")} disabled={savingCodeModeGateId===selectedGate.gate_id||(selectedGate.code_mode||"manual").toLowerCase()==="auto"}>Auto</button><button type="button" className={(selectedGate.code_mode||"manual").toLowerCase()==="manual"?"button primary":"button secondary"} onClick={()=>void setGateCodeMode(selectedGate,"manual")} disabled={savingCodeModeGateId===selectedGate.gate_id||(selectedGate.code_mode||"manual").toLowerCase()==="manual"}>Manual</button></div></div>
              <div className="combo-box combo-box--ibeacon"><span>iBeacon Requirement</span><strong>{(selectedGate.ibeacon_required??true)?"Required":"Bypassed"}</strong><p className="muted">{(selectedGate.ibeacon_required??true)?"Proximity verification is required.":selectedGate.ibeacon_disabled_reason?`Bypass reason: ${selectedGate.ibeacon_disabled_reason}`:"Proximity verification is bypassed."}</p><button type="button" className={(selectedGate.ibeacon_required??true)?"button warning":"button secondary"} onClick={()=>void toggleIBeaconRequirement(selectedGate)} disabled={savingIBeaconGateId===selectedGate.gate_id}>{savingIBeaconGateId===selectedGate.gate_id?"Saving...":(selectedGate.ibeacon_required??true)?"Disable iBeacon Requirement":"Enable iBeacon Requirement"}</button></div>
            </div>
          </Card>
          <section className="gate-manager-editor" style={{marginTop:"1.25rem"}}>
            <div className="gate-manager-editor__header"><div><span className="gate-manager-editor__eyebrow">Gate Configuration</span><h3>{selectedGate.gate_name}</h3><p>Update the next combination, gate status, effective date, and public-facing notice.</p></div></div>
            <form className="gate-manager-editor__form" onSubmit={e=>{e.preventDefault();void saveGate(selectedGate);}}>
              <label>Date<input type="date" value={selectedForm.date} onChange={e=>updateForm(selectedGate.gate_id,"date",e.target.value)}/></label>
              <label>Combination<input value={selectedForm.combination} onChange={e=>updateForm(selectedGate.gate_id,"combination",e.target.value)}/></label>
              <label>Gate Status<select value={selectedForm.gateStatus} onChange={e=>updateForm(selectedGate.gate_id,"gateStatus",e.target.value)}><option value="Open">Open</option><option value="Restricted">Restricted</option><option value="Closed">Closed</option></select></label>
              <label className="gate-manager-editor__note">Public Note<textarea value={selectedForm.notes} onChange={e=>updateForm(selectedGate.gate_id,"notes",e.target.value)}/></label>
              <div className="gate-manager-editor__actions"><button type="submit" className="button primary" disabled={savingGateId===selectedGate.gate_id}>{savingGateId===selectedGate.gate_id?"Saving...":"Save Gate Combination"}</button></div>
              {messageByGate[selectedGate.gate_id]?<p className="form-message gate-manager-editor__message">{messageByGate[selectedGate.gate_id]}</p>:null}
            </form>
          </section>
          <GateAnalytics />
        </>:null}
      </> : <section className="gate-manager-editor">
        <div className="gate-manager-editor__header"><div><span className="gate-manager-editor__eyebrow">Administration</span><h3>Gate Code History</h3><p>Review historical combinations. Codes stay hidden until you reveal an individual record.</p></div></div>
        <div style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",flexWrap:"wrap"}}><select value={historyGateId} onChange={e=>setHistoryGateId(e.target.value)}><option value="all">All gates</option>{gates.map(gate=><option key={gate.gate_id} value={gate.gate_id}>{gate.gate_name}</option>)}</select><button type="button" className="button secondary" onClick={()=>void loadGateHistory()} disabled={historyLoading}>{historyLoading?"Loading...":"Load History"}</button></div>
        {historyError?<p className="form-message">{historyError}</p>:null}
        {historyRows.length>0?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>Date</th><th>Gate</th><th>Source</th><th>Status</th><th>Combination</th></tr></thead><tbody>{historyRows.map(row=><tr key={row.id}><td>{row.valid_from||new Date(row.created_at).toLocaleDateString()}</td><td>{row.gate_name}</td><td>{row.credential_source||"—"}</td><td>{row.active?"Active":"Historical"}</td><td>{revealedCodes[row.id]?<><strong style={{letterSpacing:"0.18em"}}>{revealedCodes[row.id]}</strong> <button type="button" className="button secondary" onClick={()=>setRevealedCodes(current=>{const next={...current};delete next[row.id];return next;})}>Hide</button></>:<button type="button" className="button secondary" onClick={()=>void revealHistoricalCode(row)}>Reveal Code</button>}</td></tr>)}</tbody></table></div>:!historyLoading?<p className="muted">Select a gate or all gates, then choose Load History.</p>:null}
      </section>}
    </div>
  );
}
