"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useAccessAccounts } from "../../lib/hooks/useAccessAccounts";
import { useAccountTimeline } from "../../lib/hooks/useAccountTimeline";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { getSupabaseClient } from "../../lib/supabaseClient";
import VehicleManager from "./account/VehicleManager";
import DocumentManager from "./account/DocumentManager";
import { DEFAULT_ORGANIZATION, organizationOptionsWithCurrent } from "../../lib/organizationOptions";

function tone(status: string): "green" | "yellow" | "red" {
  if (status === "active") return "green";
  if (status === "pending") return "yellow";
  return "red";
}

function titleCase(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatIdDate(value: string | null | undefined) {
  if (!value) return "—";
  return value;
}

function formatReviewFlag(flag: string) {
  return flag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type EditProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessId: string;
  status: string;
  defaultGate: string;
  organization: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

type IdDocumentReview = {
  access_account_id: string;
  id_review_status: string | null;
  id_review_flags: string[] | null;
  review_id: string | null;
  parser_status: string | null;
  parsed_date_of_birth: string | null;
  parsed_expiration_date: string | null;
  parsed_document_type: string | null;
  parsed_issuing_authority: string | null;
  age_at_review: number | null;
  is_under_18: boolean | null;
  is_expired: boolean | null;
  is_government_id_uncertain: boolean | null;
  is_low_confidence: boolean | null;
  needs_manual_review: boolean | null;
  warning_summary: string | null;
  processed_at: string | null;
};

export default function AccessAccountProfile({
  accountId,
}: {
  accountId: string;
}) {
  const router = useRouter();

  const currentUserResult = useCurrentUser() as any;
  const currentUser =
    currentUserResult?.user ||
    currentUserResult?.currentUser ||
    currentUserResult?.profile ||
    null;

  const currentUserRole = currentUser?.role || currentUser?.app_role || "";

  const canEditAccountProfile =
    currentUserRole === "admin" ||
    currentUserRole === "super_user" ||
    currentUserRole === "super_admin";

  const { accounts, loading, error, refresh } = useAccessAccounts();

  const {
    events,
    loading: timelineLoading,
    error: timelineError,
    refresh: refreshTimeline,
  } = useAccountTimeline(accountId);

  const account = accounts.find((item) => item.id === accountId) as any;

  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [idReview, setIdReview] = useState<IdDocumentReview | null>(null);
  const [idReviewLoading, setIdReviewLoading] = useState(false);
  const [idReviewError, setIdReviewError] = useState("");
  const [idReviewExpanded, setIdReviewExpanded] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [activatingAccount, setActivatingAccount] = useState(false);
  const [suspendingAccount, setSuspendingAccount] = useState(false);
  const [renewingAccount, setRenewingAccount] = useState(false);
  const [revokingAccount, setRevokingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [editForm, setEditForm] = useState<EditProfileForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    accessId: "",
    status: "pending",
    defaultGate: "",
    organization: DEFAULT_ORGANIZATION,
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadIdReview() {
      setIdReviewLoading(true);
      setIdReviewError("");

      try {
        const supabase = getSupabaseClient() as any;

        const { data, error } = await supabase.rpc(
          "get_admin_access_account_id_review",
          {
            p_access_account_id: accountId,
          }
        );

        if (error) {
          throw error;
        }

        const review = Array.isArray(data) ? data[0] || null : data || null;

        if (isMounted) {
          setIdReview(review);
        }
      } catch (error) {
        if (isMounted) {
          setIdReviewError(
            error instanceof Error
              ? error.message
              : "Unable to load ID document review."
          );
        }
      } finally {
        if (isMounted) {
          setIdReviewLoading(false);
        }
      }
    }

    loadIdReview();

    return () => {
      isMounted = false;
    };
  }, [accountId]);

  useEffect(() => {
    if (!account) return;

    setNotes(account.internal_notes || "");

    setEditForm({
      firstName:
        account.applicant?.first_name || account.applicant_first_name || "",
      lastName:
        account.applicant?.last_name || account.applicant_last_name || "",
      email: account.applicant?.email || account.applicant_email || "",
      phone: account.applicant?.phone || account.applicant_phone || "",
      accessId: account.access_id || "",
      status: account.status || "pending",
      defaultGate: account.default_gate || "",
      organization: account.organization || DEFAULT_ORGANIZATION,
      emergencyContactName: account.emergency_contact_name || "",
      emergencyContactPhone: account.emergency_contact_phone || "",
    });
  }, [account]);

  useEffect(() => {
    if (!canEditAccountProfile && editingProfile) {
      setEditingProfile(false);
    }
  }, [canEditAccountProfile, editingProfile]);

  function updateEditForm(field: keyof EditProfileForm, value: string) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEditProfile() {
    if (!account) return;

    setEditForm({
      firstName:
        account.applicant?.first_name || account.applicant_first_name || "",
      lastName:
        account.applicant?.last_name || account.applicant_last_name || "",
      email: account.applicant?.email || account.applicant_email || "",
      phone: account.applicant?.phone || account.applicant_phone || "",
      accessId: account.access_id || "",
      status: account.status || "pending",
      defaultGate: account.default_gate || "",
      organization: account.organization || DEFAULT_ORGANIZATION,
      emergencyContactName: account.emergency_contact_name || "",
      emergencyContactPhone: account.emergency_contact_phone || "",
    });

    setEditingProfile(false);
  }

  async function saveProfile() {
    if (!canEditAccountProfile) {
      alert("Only admins and super users can edit account profiles.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to save account profile.");
        return;
      }

      await refresh();
      await refreshTimeline();
      setEditingProfile(false);
      alert("Account profile saved.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save account profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to save notes.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Notes saved.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function renewAccount() {
    setRenewingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/renew`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to renew account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Account renewed.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to renew account.");
    } finally {
      setRenewingAccount(false);
    }
  }

  async function suspendAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to suspend this access account?"
    );

    if (!confirmed) return;

    setSuspendingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/suspend`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to suspend account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Account suspended.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to suspend account."
      );
    } finally {
      setSuspendingAccount(false);
    }
  }

  async function activateAccount() {
    let activationMessage =
      "Activate this access account? This will assign an Access ID and send the applicant a confirmation email.";

    const hasIdReviewWarning =
      idReview?.id_review_status === "warning" ||
      idReview?.id_review_status === "manual_review" ||
      idReview?.needs_manual_review === true;

    if (hasIdReviewWarning) {
      const flags =
        idReview?.id_review_flags && idReview.id_review_flags.length > 0
          ? idReview.id_review_flags.map(formatReviewFlag).join(", ")
          : "ID review warning";

      activationMessage =
        `This account has ID document review warnings.\n\n` +
        `Flags: ${flags}\n\n` +
        `${
          idReview?.warning_summary ||
          "This ID may require closer manual review."
        }\n\n` +
        `Admin may still approve this account after manual review.\n\n` +
        `Do you still want to activate this access account?`;
    }

    const confirmed = window.confirm(activationMessage);

    if (!confirmed) return;

    setActivatingAccount(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/activate`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to activate account.");
        return;
      }

      await refresh();
      await refreshTimeline();

      const accessId = result.accessId || result.account?.access_id;

      alert(
        accessId
          ? `Account activated. Access ID: ${accessId}`
          : "Account activated."
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to activate account."
      );
    } finally {
      setActivatingAccount(false);
    }
  }

  async function revokeAccount() {
    if (!account) return;

    const accessId = account.access_id || "Pending";
    const firstName =
      account.applicant?.first_name || account.applicant_first_name || "";
    const lastName =
      account.applicant?.last_name || account.applicant_last_name || "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";

    const confirmed = window.confirm(
      `Revoke this access account?\n\nName: ${name}\nAccess ID: ${accessId}\n\nThis will preserve the account history but prevent the account from being treated as active.`
    );

    if (!confirmed) return;

    setRevokingAccount(true);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("access_accounts")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (error) {
        alert(error.message || "Unable to revoke account.");
        return;
      }

      await refresh();
      await refreshTimeline();
      alert("Access account revoked.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to revoke account."
      );
    } finally {
      setRevokingAccount(false);
    }
  }

  async function deleteAccount() {
    if (!account) return;

    const accessId = account.access_id || "Pending";
    const firstName =
      account.applicant?.first_name || account.applicant_first_name || "";
    const lastName =
      account.applicant?.last_name || account.applicant_last_name || "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";

    const confirmed = window.confirm(
      `Delete this access account?\n\nName: ${name}\nAccess ID: ${accessId}\n\nThis is permanent and cannot be undone.`
    );

    if (!confirmed) return;

    const password = window.prompt(
      "Enter your admin password to confirm deletion:"
    );

    if (!password) return;

    setDeletingAccount(true);

    try {
      const supabase = getSupabaseClient() as any;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.email) {
        alert("Unable to verify the current admin user.");
        return;
      }

      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (passwordError) {
        alert("Password verification failed. Account was not deleted.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("access_accounts")
        .delete()
        .eq("id", accountId);

      if (deleteError) {
        alert(
          deleteError.message ||
            "Unable to delete access account. If this account has request history, revoke the account instead."
        );
        return;
      }

      alert("Access account deleted.");
      router.push("/admin/access-accounts");
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete access account."
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  if (loading) {
    return <p className="muted-text">Loading account profile...</p>;
  }

  if (error) {
    return (
      <Card title="Unable to Load Account">
        <p>{error}</p>
        <button className="button secondary" onClick={refresh} type="button">
          Try Again
        </button>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card title="Account Not Found">
        <p className="muted-text">This access account could not be found.</p>
        <Link className="button secondary" href="/admin/access-accounts">
          Back to Access Accounts
        </Link>
      </Card>
    );
  }

  const firstName =
    account.applicant?.first_name || account.applicant_first_name || "";
  const lastName =
    account.applicant?.last_name || account.applicant_last_name || "";
  const email = account.applicant?.email || account.applicant_email || "";
  const phone = account.applicant?.phone || account.applicant_phone || "";

  const name = `${firstName} ${lastName}`.trim() || "Unknown Applicant";
  const displayName = `${editForm.firstName} ${editForm.lastName}`.trim() || name;

  const accountStatus = account.status || "pending";
  const hasAccessId = Boolean(account.access_id);

  const hasVisibleIdReviewWarning =
    idReview?.id_review_status === "warning" ||
    idReview?.id_review_status === "manual_review" ||
    idReview?.needs_manual_review === true;

  const idReviewFlagsText =
    idReview?.id_review_flags && idReview.id_review_flags.length > 0
      ? idReview.id_review_flags.map(formatReviewFlag).join(", ")
      : "";

  const idReviewSummaryText = hasVisibleIdReviewWarning
    ? idReview?.warning_summary ||
      "This ID document may require closer review before approval."
    : idReview?.id_review_status === "clear"
      ? "No automated ID warnings were found."
      : "ID has not been automatically reviewed yet.";

  return (
    <>
      <div className="page-heading">
        <p>Access Account Profile</p>
        <h2>{displayName}</h2>
        <span>
          Full access account record, vehicles, emergency contact, and account
          status.
        </span>
      </div>

      <div className="account-management-layout">
        <div>
          <Card title="360° Account Overview">
            <div className="profile-header-row">
              <div>
                <h2>{displayName}</h2>
                <p>{account.access_id || "Access ID pending"}</p>
              </div>

              <StatusBadge
                label={titleCase(accountStatus)}
                tone={tone(accountStatus)}
              />
            </div>

            <div className="profile-metric-grid">
              <div>
                <span>Status</span>
                <strong>{titleCase(accountStatus)}</strong>
              </div>

              <div>
                <span>Access ID</span>
                <strong>{account.access_id || "Pending"}</strong>
              </div>

              <div>
                <span>Preferred Gate</span>
                <strong>{account.default_gate || "—"}</strong>
              </div>

              <div>
                <span>Vehicles</span>
                <strong>{account.vehicles?.length || 0}</strong>
              </div>
            </div>
          </Card>

          <Card title="Applicant Information">
            {canEditAccountProfile && (
              <div className="profile-card-actions">
                {!editingProfile ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setEditingProfile(true)}
                  >
                    Edit Account Profile
                  </button>
                ) : (
                  <>
                    <button
                      className="button primary"
                      type="button"
                      onClick={saveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      className="button secondary"
                      type="button"
                      onClick={cancelEditProfile}
                      disabled={savingProfile}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Name</span>
                  <strong>{name}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{email || "—"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{phone || "—"}</strong>
                </div>

                <div>
                  <span>Organization / Agency</span>
                  <strong>{account.organization || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  First Name
                  <input
                    value={editForm.firstName}
                    onChange={(event) =>
                      updateEditForm("firstName", event.target.value)
                    }
                  />
                </label>

                <label>
                  Last Name
                  <input
                    value={editForm.lastName}
                    onChange={(event) =>
                      updateEditForm("lastName", event.target.value)
                    }
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      updateEditForm("email", event.target.value)
                    }
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={editForm.phone}
                    onChange={(event) =>
                      updateEditForm("phone", event.target.value)
                    }
                  />
                </label>

                <label>
                  Organization / Agency
                  <select
                    value={editForm.organization}
                    onChange={(event) =>
                      updateEditForm("organization", event.target.value)
                    }
                  >
                    {organizationOptionsWithCurrent(editForm.organization).map(
                      (organization) => (
                        <option key={organization} value={organization}>
                          {organization}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            )}
          </Card>

          <Card title="Access Account Details">
            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Access ID</span>
                  <strong>{account.access_id || "Pending"}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{titleCase(accountStatus)}</strong>
                </div>

                <div>
                  <span>Preferred Gate</span>
                  <strong>{account.default_gate || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  Access ID
                  <input
                    value={editForm.accessId}
                    onChange={(event) =>
                      updateEditForm("accessId", event.target.value)
                    }
                  />
                </label>

                <label>
                  Account Status
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      updateEditForm("status", event.target.value)
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                    <option value="denied">Denied</option>
                  </select>
                </label>

                <label>
                  Preferred Gate
                  <input
                    value={editForm.defaultGate}
                    onChange={(event) =>
                      updateEditForm("defaultGate", event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </Card>

          <Card title="Emergency Contact">
            {!editingProfile ? (
              <div className="profile-detail-list">
                <div>
                  <span>Name</span>
                  <strong>{account.emergency_contact_name || "—"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{account.emergency_contact_phone || "—"}</strong>
                </div>
              </div>
            ) : (
              <div className="mobile-form-stack">
                <label>
                  Emergency Contact Name
                  <input
                    value={editForm.emergencyContactName}
                    onChange={(event) =>
                      updateEditForm(
                        "emergencyContactName",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Emergency Contact Phone
                  <input
                    value={editForm.emergencyContactPhone}
                    onChange={(event) =>
                      updateEditForm(
                        "emergencyContactPhone",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            )}
          </Card>

          <VehicleManager
            accountId={accountId}
            vehicles={account.vehicles || []}
            refresh={refresh}
            refreshTimeline={refreshTimeline}
          />
        </div>

        <div className="account-profile-column">
          <DocumentManager
            accountId={accountId}
            refreshTimeline={refreshTimeline}
          />

          <section
            style={{
              marginBottom: 16,
              borderRadius: 18,
              border: hasVisibleIdReviewWarning
                ? "2px solid #f59e0b"
                : "1px solid rgba(148, 163, 184, 0.35)",
              background: hasVisibleIdReviewWarning ? "#fff7ed" : "white",
              boxShadow: hasVisibleIdReviewWarning
                ? "0 12px 30px rgba(245, 158, 11, 0.22)"
                : "0 8px 24px rgba(15, 23, 42, 0.08)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setIdReviewExpanded((current) => !current)}
              aria-expanded={idReviewExpanded}
              style={{
                width: "100%",
                border: "none",
                background: hasVisibleIdReviewWarning ? "#fed7aa" : "transparent",
                padding: "18px 20px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: 18 }}>ID Document Review</strong>

                  {hasVisibleIdReviewWarning && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        background: "#ea580c",
                        color: "white",
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      }}
                    >
                      Warning
                    </span>
                  )}

                  {!hasVisibleIdReviewWarning &&
                    idReview?.id_review_status === "clear" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          background: "#16a34a",
                          color: "white",
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: 0.3,
                          textTransform: "uppercase",
                        }}
                      >
                        Clear
                      </span>
                    )}
                </div>

                <p
                  style={{
                    margin: 0,
                    color: hasVisibleIdReviewWarning ? "#7c2d12" : "#64748b",
                    fontWeight: hasVisibleIdReviewWarning ? 700 : 400,
                  }}
                >
                  {idReviewLoading
                    ? "Loading ID document review..."
                    : idReviewError
                      ? "Unable to load ID review."
                      : idReviewSummaryText}
                </p>

                {hasVisibleIdReviewWarning && idReviewFlagsText && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#9a3412",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Flags: {idReviewFlagsText}
                  </p>
                )}

                <p
                  style={{
                    margin: "8px 0 0",
                    color: hasVisibleIdReviewWarning ? "#9a3412" : "#64748b",
                    fontSize: 13,
                    fontWeight: hasVisibleIdReviewWarning ? 700 : 500,
                  }}
                >
                  {idReviewExpanded
                    ? "Click to collapse ID review details."
                    : "Click to expand ID review details."}
                </p>
              </div>

              <span
                aria-hidden="true"
                style={{
                  color: hasVisibleIdReviewWarning ? "#9a3412" : "#64748b",
                  fontSize: 22,
                  fontWeight: 800,
                  transform: idReviewExpanded
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 160ms ease",
                }}
              >
                ▾
              </span>
            </button>

            {idReviewExpanded && (
              <div style={{ padding: "18px 20px 20px" }}>
                {idReviewLoading && (
                  <p className="muted-text">Loading ID document review...</p>
                )}

                {idReviewError && (
                  <div className="error-callout">
                    <strong>Unable to load ID review</strong>
                    <p>{idReviewError}</p>
                  </div>
                )}

                {!idReviewLoading && !idReviewError && !idReview && (
                  <p className="muted-text">
                    ID has not been automatically reviewed yet.
                  </p>
                )}

                {!idReviewLoading &&
                  !idReviewError &&
                  idReview?.id_review_status === "not_checked" && (
                    <p className="muted-text">
                      ID has not been automatically reviewed yet.
                    </p>
                  )}

                {!idReviewLoading &&
                  !idReviewError &&
                  idReview?.id_review_status === "clear" && (
                    <div className="profile-detail-list">
                      <div>
                        <span>ID Review Status</span>
                        <strong>Clear</strong>
                      </div>

                      <div>
                        <span>Summary</span>
                        <strong>No automated ID warnings were found.</strong>
                      </div>

                      <div>
                        <span>Parser Status</span>
                        <strong>{idReview.parser_status || "—"}</strong>
                      </div>

                      <div>
                        <span>Processed At</span>
                        <strong>
                          {idReview.processed_at
                            ? formatDateTime(idReview.processed_at)
                            : "—"}
                        </strong>
                      </div>
                    </div>
                  )}

                {!idReviewLoading &&
                  !idReviewError &&
                  idReview &&
                  idReview.id_review_status !== "not_checked" &&
                  idReview.id_review_status !== "clear" && (
                    <div
                      style={{
                        borderRadius: 14,
                        background: "#ffedd5",
                        border: "1px solid #fb923c",
                        padding: 16,
                      }}
                    >
                      <strong style={{ color: "#7c2d12" }}>
                        ID Review Warning
                      </strong>

                      <p style={{ color: "#7c2d12" }}>
                        {idReview.warning_summary ||
                          "This ID document may require closer review before approval."}
                      </p>

                      <div
                        className="profile-detail-list"
                        style={{ marginTop: 12 }}
                      >
                        {idReview.id_review_flags &&
                          idReview.id_review_flags.length > 0 && (
                            <div>
                              <span>Flags</span>
                              <strong>
                                {idReview.id_review_flags
                                  .map(formatReviewFlag)
                                  .join(", ")}
                              </strong>
                            </div>
                          )}

                        <div>
                          <span>Date of Birth</span>
                          <strong>
                            {formatIdDate(idReview.parsed_date_of_birth)}
                          </strong>
                        </div>

                        <div>
                          <span>Age at Review</span>
                          <strong>{idReview.age_at_review ?? "—"}</strong>
                        </div>

                        <div>
                          <span>Expiration Date</span>
                          <strong>
                            {formatIdDate(idReview.parsed_expiration_date)}
                          </strong>
                        </div>

                        <div>
                          <span>Document Type</span>
                          <strong>
                            {idReview.parsed_document_type || "—"}
                          </strong>
                        </div>

                        <div>
                          <span>Issuing Authority</span>
                          <strong>
                            {idReview.parsed_issuing_authority || "—"}
                          </strong>
                        </div>

                        <div>
                          <span>Parser Status</span>
                          <strong>{idReview.parser_status || "—"}</strong>
                        </div>

                        <div>
                          <span>Processed At</span>
                          <strong>
                            {idReview.processed_at
                              ? formatDateTime(idReview.processed_at)
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      <p className="muted-text" style={{ marginTop: 12 }}>
                        Admin may still approve this account after manual
                        review.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </section>
        </div>

        <div className="account-profile-column">
          <Card title="Quick Actions">
            <div className="quick-action-button-grid">
              <Link className="button secondary" href="/admin/access-accounts">
                Back to Accounts
              </Link>

              {accountStatus === "active" ? (
                <button
                  className="button danger"
                  type="button"
                  onClick={suspendAccount}
                  disabled={
                    suspendingAccount || revokingAccount || deletingAccount
                  }
                >
                  {suspendingAccount ? "Suspending..." : "Suspend Account"}
                </button>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  onClick={activateAccount}
                  disabled={
                    activatingAccount || revokingAccount || deletingAccount
                  }
                >
                  {activatingAccount ? "Activating..." : "Activate Account"}
                </button>
              )}

              <button
                className="button secondary"
                type="button"
                onClick={renewAccount}
                disabled={
                  renewingAccount ||
                  !hasAccessId ||
                  revokingAccount ||
                  deletingAccount
                }
                title={
                  hasAccessId
                    ? "Renew this account"
                    : "Activate the account before renewing"
                }
              >
                {renewingAccount ? "Renewing..." : "Renew"}
              </button>

              <button className="button secondary" type="button">
                Send SMS
              </button>

              <button
                className="button danger"
                type="button"
                onClick={revokeAccount}
                disabled={revokingAccount || deletingAccount}
              >
                {revokingAccount ? "Revoking..." : "Revoke Account"}
              </button>

              <button
                className="button danger"
                type="button"
                onClick={deleteAccount}
                disabled={deletingAccount || revokingAccount}
              >
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>

            <p className="muted-text" style={{ marginTop: 12 }}>
              Revoke preserves history. Delete is permanent and requires the
              current admin password.
            </p>
          </Card>

          <Card title="Administrator Notes">
            <div className="mobile-form-stack">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Enter internal administrator notes..."
                rows={6}
              />

              <button
                className="button primary"
                type="button"
                onClick={saveNotes}
                disabled={savingNotes || deletingAccount || revokingAccount}
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </Card>

          <Card title="Timeline">
            {timelineLoading && (
              <p className="muted-text">Loading timeline events...</p>
            )}

            {timelineError && (
              <div className="error-callout">
                <strong>Unable to load timeline</strong>
                <p>{timelineError}</p>
              </div>
            )}

            {!timelineLoading && !timelineError && events.length === 0 && (
              <p className="muted-text">No timeline events yet.</p>
            )}

            {!timelineLoading && !timelineError && events.length > 0 && (
              <div className="timeline-list">
                {events.map((event: any) => (
                  <div key={event.id}>
                    <span>{formatDateTime(event.created_at)}</span>
                    <strong>{event.event_title}</strong>
                    {event.event_body && <p>{event.event_body}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}