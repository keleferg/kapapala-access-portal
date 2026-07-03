"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type AccessAccount = {
  id: string;
  access_id: string | null;
  status: string | null;
  default_gate: string | null;
};

function statusTone(status: string | null): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function formatStatus(status: string | null) {
  if (!status) return "Pending";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccessCard() {
  const [account, setAccount] = useState<AccessAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAccessAccount();
  }, []);

  async function loadAccessAccount() {
    setLoading(true);
    setErrorMessage(null);

    const supabase = getSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAccount(null);
      setErrorMessage("Unable to load signed-in user.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("access_accounts")
      .select(`
        id,
        access_id,
        status,
        default_gate
      `)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load access account:", error);
      setAccount(null);
      setErrorMessage(error.message || "Unable to load access account.");
      setLoading(false);
      return;
    }

    setAccount(data as AccessAccount | null);
    setLoading(false);
  }

  if (loading) {
    return (
      <Card title="My Access ID" subtitle="Account status">
        <div className="big-value">Loading...</div>
        <p className="muted-text">Checking your access account.</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card title="My Access ID" subtitle="Account status">
        <div className="big-value">Unavailable</div>
        <StatusBadge label="Error" tone="red" />
        <p className="muted-text">{errorMessage}</p>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card title="My Access ID" subtitle="Account status">
        <div className="big-value">Pending</div>
        <StatusBadge label="No Account" tone="yellow" />
        <p className="muted-text">No access account is linked to your profile.</p>
      </Card>
    );
  }

  return (
    <Card title="My Access ID" subtitle="Account status">
      <div className="big-value">{account.access_id || "Pending"}</div>

      <StatusBadge
        label={formatStatus(account.status)}
        tone={statusTone(account.status)}
      />

      <p className="muted-text">
        {account.default_gate
          ? `Preferred gate: ${account.default_gate}`
          : "Access account information is current."}
      </p>
    </Card>
  );
}