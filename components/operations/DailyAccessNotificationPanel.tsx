"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

type Gate = {
  id: string;
  name: string;
};

type RecipientPreview = {
  request_id: string;
  request_date: string;
  gate_id: string | null;
  gate_name: string | null;
  access_account_id: string;
  access_id: string | null;
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type SendResult = {
  communication_message_id: string;
  recipient_count: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getHawaiiTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

export default function DailyAccessNotificationPanel() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [targetDate, setTargetDate] = useState(getHawaiiTodayDateString());
  const [gateId, setGateId] = useState("");
  const [severity, setSeverity] = useState("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [recipients, setRecipients] = useState<RecipientPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recipientCount = recipients.length;

  const selectedGateName = useMemo(() => {
    if (!gateId) {
      return "All Gates";
    }

    return gates.find((gate) => gate.id === gateId)?.name ?? "Selected Gate";
  }, [gateId, gates]);

  useEffect(() => {
    loadGates();
  }, []);

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, gateId]);

  async function loadGates() {
    const { data, error } = await supabase
      .from("gates")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setGates(data ?? []);
  }

  async function loadPreview() {
    setLoadingPreview(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { data, error } = await supabase.rpc(
      "admin_preview_daily_access_notification_recipients",
      {
        p_target_date: targetDate,
        p_gate_id: gateId || null,
      }
    );

    if (error) {
      setRecipients([]);
      setErrorMessage(error.message);
      setLoadingPreview(false);
      return;
    }

    setRecipients((data ?? []) as RecipientPreview[]);
    setLoadingPreview(false);
  }

  async function sendNotification() {
    setSending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanedTitle = title.trim();
    const cleanedBody = body.trim();

    if (!cleanedTitle) {
      setErrorMessage("Please enter a notification title.");
      setSending(false);
      return;
    }

    if (!cleanedBody) {
      setErrorMessage("Please enter a notification message.");
      setSending(false);
      return;
    }

    const { data, error } = await supabase.rpc(
      "admin_send_daily_access_notification",
      {
        p_target_date: targetDate,
        p_gate_id: gateId || null,
        p_title: cleanedTitle,
        p_body: cleanedBody,
        p_severity: severity,
      }
    );

    if (error) {
      setErrorMessage(error.message);
      setSending(false);
      return;
    }

    const result = (data?.[0] ?? null) as SendResult | null;
    const count = result?.recipient_count ?? 0;

    setStatusMessage(
      `Notification sent to ${count} user${count === 1 ? "" : "s"} for ${selectedGateName}.`
    );

    setTitle("");
    setBody("");

    await loadPreview();

    setSending(false);
  }

  return (
    <>
      <Card title="New Access Notification">
        <div className="stack">
          <p className="muted">
            This sends an in-app notification to users with approved access for the selected date.
          </p>

          <div className="form-grid">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>

            <label>
              <span>Gate</span>
              <select
                value={gateId}
                onChange={(event) => setGateId(event.target.value)}
              >
                <option value="">All Gates</option>
                {gates.map((gate) => (
                  <option key={gate.id} value={gate.id}>
                    {gate.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Severity</span>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          <label>
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Wood Valley Access Notice"
            />
          </label>

          <label>
            <span>Message</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder="Type the notification message users should see in the iOS app."
            />
          </label>

          {errorMessage ? (
            <div className="error-box">{errorMessage}</div>
          ) : null}

          {statusMessage ? (
            <div className="success-box">{statusMessage}</div>
          ) : null}

          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              onClick={loadPreview}
              disabled={loadingPreview || sending}
            >
              {loadingPreview ? "Refreshing..." : "Refresh Recipients"}
            </button>

            <button
              className="button"
              type="button"
              onClick={sendNotification}
              disabled={sending || recipientCount === 0}
            >
              {sending
                ? "Sending..."
                : `Send to ${recipientCount} User${recipientCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Recipient Preview">
        <div className="stack">
          <div className="panel-row">
            <div>
              <p className="muted">
                {loadingPreview
                  ? "Loading recipients..."
                  : `${recipientCount} approved user${recipientCount === 1 ? "" : "s"} for ${selectedGateName} on ${targetDate}.`}
              </p>
            </div>

            <StatusBadge
              label={`${recipientCount} Recipient${recipientCount === 1 ? "" : "s"}`}
              tone={recipientCount > 0 ? "green" : "gray"}
            />
          </div>

          {recipients.length === 0 ? (
            <p className="muted">No approved users found for this date and gate.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => {
                    const name = [recipient.first_name, recipient.last_name]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr key={recipient.request_id}>
                        <td>{recipient.access_id ?? "—"}</td>
                        <td>{name || "—"}</td>
                        <td>{recipient.email ?? "—"}</td>
                        <td>{recipient.gate_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}