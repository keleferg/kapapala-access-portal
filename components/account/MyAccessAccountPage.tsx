"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";
import AccessAccountWizard from "./AccessAccountWizard";
import { DEFAULT_ORGANIZATION, organizationOptionsWithCurrent } from "../../lib/organizationOptions";

type AccessAccount = {
  id: string;
  access_id: string | null;
  status: string | null;
  default_gate: string | null;
  organization: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type AccountForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  defaultGate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const preferredGateOptions = [
  { label: "No preference", value: "" },
  { label: "Wood Valley", value: "Wood Valley" },
  { label: "Honanui", value: "Honanui" },
  { label: "ʻĀinapō", value: "ʻĀinapō" },
];

function titleCase(value: string | null | undefined) {
  if (!value) return "Pending";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string | null): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

export default function MyAccessAccountPage() {
  const [account, setAccount] = useState<AccessAccount | null>(null);

  const [form, setForm] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organization: DEFAULT_ORGANIZATION,
    defaultGate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasNoAccount, setHasNoAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setErrorMessage(null);
    setHasNoAccount(false);

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

    const { data, error } = await supabase
      .from("access_accounts")
      .select(`
        id,
        access_id,
        status,
        default_gate,
        organization,
        emergency_contact_name,
        emergency_contact_phone,
        profiles!access_accounts_profile_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load access account:", error);
      setErrorMessage(error.message || "Unable to load access account.");
      setLoading(false);
      return;
    }

    if (!data) {
      setHasNoAccount(true);
      setAccount(null);
      setLoading(false);
      return;
    }

    const loadedAccount = data as AccessAccount;

    setAccount(loadedAccount);

    setForm({
      firstName: loadedAccount.profiles?.first_name || "",
      lastName: loadedAccount.profiles?.last_name || "",
      email: loadedAccount.profiles?.email || "",
      phone: loadedAccount.profiles?.phone || "",
      organization: loadedAccount.organization || DEFAULT_ORGANIZATION,
      defaultGate: loadedAccount.default_gate || "",
      emergencyContactName: loadedAccount.emergency_contact_name || "",
      emergencyContactPhone: loadedAccount.emergency_contact_phone || "",
    });

    setLoading(false);
  }

  function updateForm(field: keyof AccountForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEdit() {
    if (!account) return;

    setForm({
      firstName: account.profiles?.first_name || "",
      lastName: account.profiles?.last_name || "",
      email: account.profiles?.email || "",
      phone: account.profiles?.phone || "",
      organization: account.organization || DEFAULT_ORGANIZATION,
      defaultGate: account.default_gate || "",
      emergencyContactName: account.emergency_contact_name || "",
      emergencyContactPhone: account.emergency_contact_phone || "",
    });

    setEditing(false);
  }

  async function saveChanges() {
    if (!account) return;

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/my-access-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to save access account.");
        return;
      }

      await loadAccount();
      setEditing(false);
      alert("Access account updated.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save access account."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card title="My Access Account">
        <p className="muted-text">Loading your access account...</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card title="My Access Account">
        <div className="error-callout">
          <strong>Unable to load account</strong>
          <p>{errorMessage}</p>
        </div>
      </Card>
    );
  }

  if (hasNoAccount) {
    return (
      <>
        <div className="page-heading">
          <p>Access Account</p>
          <h2>Apply for an Access Account</h2>
          <span>
            Create your Kapāpala Forest Reserve access account, upload your ID,
            save vehicles, and agree to the public access rules.
          </span>
        </div>

        <AccessAccountWizard />
      </>
    );
  }

  if (!account) {
    return (
      <Card title="My Access Account">
        <p className="muted-text">No access account found.</p>
      </Card>
    );
  }

  const fullName =
    `${account.profiles?.first_name || ""} ${
      account.profiles?.last_name || ""
    }`.trim() || "Access Account Holder";

  return (
    <>
      <div className="page-heading">
        <p>My Access Account</p>
        <h2>{fullName}</h2>
        <span>
          View and update your contact information, emergency contact, preferred
          gate, and account details.
        </span>
      </div>

      <div className="account-self-service-layout">
        <Card title="Account Summary">
          <div className="profile-header-row">
            <div>
              <h2>{account.access_id || "Access ID Pending"}</h2>
              <p>{fullName}</p>
            </div>

            <StatusBadge
              label={titleCase(account.status)}
              tone={statusTone(account.status)}
            />
          </div>

          <div className="profile-metric-grid">
            <div>
              <span>Status</span>
              <strong>{titleCase(account.status)}</strong>
            </div>

            <div>
              <span>Access ID</span>
              <strong>{account.access_id || "Pending"}</strong>
            </div>

            <div>
              <span>Preferred Gate</span>
              <strong>{account.default_gate || "—"}</strong>
            </div>
          </div>
        </Card>

        <Card title="My Information">
          <div className="profile-card-actions">
            {!editing ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit My Information
              </button>
            ) : (
              <>
                <button
                  className="button primary"
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>

                <button
                  className="button secondary"
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {!editing ? (
            <div className="profile-detail-list">
              <div>
                <span>Name</span>
                <strong>{fullName}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{account.profiles?.email || "—"}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{account.profiles?.phone || "—"}</strong>
              </div>

              <div>
                <span>Organization / Agency</span>
                <strong>{account.organization || "—"}</strong>
              </div>

              <div>
                <span>Preferred Gate</span>
                <strong>{account.default_gate || "—"}</strong>
              </div>

              <div>
                <span>Emergency Contact</span>
                <strong>
                  {account.emergency_contact_name || "—"}
                  {account.emergency_contact_phone
                    ? ` • ${account.emergency_contact_phone}`
                    : ""}
                </strong>
              </div>
            </div>
          ) : (
            <div className="mobile-form-stack">
              <label>
                First Name
                <input
                  value={form.firstName}
                  onChange={(event) =>
                    updateForm("firstName", event.target.value)
                  }
                />
              </label>

              <label>
                Last Name
                <input
                  value={form.lastName}
                  onChange={(event) =>
                    updateForm("lastName", event.target.value)
                  }
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </label>

              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                />
              </label>

              <label>
                Organization / Agency
                <select
                  value={form.organization}
                  onChange={(event) =>
                    updateForm("organization", event.target.value)
                  }
                >
                  {organizationOptionsWithCurrent(form.organization).map(
                    (organization) => (
                      <option key={organization} value={organization}>
                        {organization}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Preferred Gate
                <select
                  value={form.defaultGate}
                  onChange={(event) =>
                    updateForm("defaultGate", event.target.value)
                  }
                >
                  {preferredGateOptions.map((gate) => (
                    <option key={gate.label} value={gate.value}>
                      {gate.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Emergency Contact Name
                <input
                  value={form.emergencyContactName}
                  onChange={(event) =>
                    updateForm("emergencyContactName", event.target.value)
                  }
                />
              </label>

              <label>
                Emergency Contact Phone
                <input
                  value={form.emergencyContactPhone}
                  onChange={(event) =>
                    updateForm("emergencyContactPhone", event.target.value)
                  }
                />
              </label>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}