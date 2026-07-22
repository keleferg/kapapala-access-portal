"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { formatDeviceType } from "../../lib/deviceTypeOptions";

type RenewalStatus =
  | "draft"
  | "pending"
  | "corrections_required"
  | "approved"
  | "denied"
  | "cancelled";

type RenewalRequest = {
  renewal_request_id: string;
  access_account_id: string;
  access_id: string | null;
  account_status: string;
  current_expiration_date: string | null;
  proposed_expiration_date: string | null;
  renewal_status: RenewalStatus | string;
  submitted_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  organization: string;
  device_type: string;
  default_gate: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  mailing_address: string;
  id_document_path: string | null;
  rules_version: string | null;
  user_comments: string | null;
  admin_comments: string | null;
  corrections_required_reason: string | null;
  denial_reason: string | null;
};

const STATUS_OPTIONS = [
  "pending",
  "corrections_required",
  "approved",
  "denied",
  "all",
] as const;

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const normalized = value.slice(0, 10);
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) return normalized;

  return `${month}/${day}/${year}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTone(status: string): "green" | "yellow" | "red" {
  if (status === "approved") return "green";

  if (
    status === "pending" ||
    status === "corrections_required"
  ) {
    return "yellow";
  }

  return "red";
}

export default function AccountRenewalRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<RenewalRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase.rpc(
        "get_admin_account_renewal_requests",
        {
          p_status: statusFilter,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const rows = Array.isArray(data) ? data : [];

      setRequests(rows);

      setSelectedId((current) => {
        if (
          current &&
          rows.some(
            (request: RenewalRequest) =>
              request.renewal_request_id === current
          )
        ) {
          return current;
        }

        return rows[0]?.renewal_request_id || null;
      });
    } catch (error) {
      setRequests([]);
      setSelectedId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load renewal requests."
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) => {
      const searchable = [
        request.access_id,
        request.first_name,
        request.last_name,
        request.email,
        request.phone,
        request.organization,
        request.renewal_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [requests, search]);

  const selected =
    filteredRequests.find(
      (request) =>
        request.renewal_request_id === selectedId
    ) ||
    filteredRequests[0] ||
    null;

  async function sendRenewalEmail(
    type:
      | "corrections_required"
      | "approved"
      | "denied",
    renewalRequestId: string
  ) {
    const supabase = getSupabaseClient() as any;

    const { data, error } =
      await supabase.functions.invoke(
        "send-account-renewal-email",
        {
          body: {
            type,
            renewal_request_id: renewalRequestId,
          },
        }
      );

    if (error) {
      throw new Error(
        error.message ||
          "Unable to send renewal email."
      );
    }

    if (!data?.success) {
      throw new Error(
        data?.error ||
          "The renewal email was not sent."
      );
    }

    return data;
  }

  async function approveRenewal(request: RenewalRequest) {
    const comments = window.prompt(
      "Optional administrator comments:",
      request.admin_comments || ""
    );

    if (comments === null) return;

    const confirmed = window.confirm(
      `Approve this renewal?\n\n` +
        `Name: ${request.first_name} ${request.last_name}\n` +
        `Access ID: ${request.access_id || "—"}\n` +
        `Current expiration: ${formatDate(
          request.current_expiration_date
        )}\n` +
        `Proposed expiration: ${formatDate(
          request.proposed_expiration_date
        )}\n\n` +
        `The submitted information will be applied to the live account.`
    );

    if (!confirmed) return;

    setProcessingId(request.renewal_request_id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase.rpc(
        "admin_approve_account_renewal",
        {
          p_renewal_request_id:
            request.renewal_request_id,
          p_admin_comments: comments.trim() || null,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const row = Array.isArray(data) ? data[0] : data;

      let approvalMessage =
        `Renewal approved. New expiration: ${formatDate(
          row?.new_expiration_date
        )}.`;

      try {
        await sendRenewalEmail(
          "approved",
          request.renewal_request_id
        );

        approvalMessage +=
          " Approval email sent.";
      } catch (emailError) {
        approvalMessage +=
          ` The account was renewed, but the approval email could not be sent: ${
            emailError instanceof Error
              ? emailError.message
              : "Unknown email error."
          }`;
      }

      setSuccessMessage(approvalMessage);

      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to approve renewal."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function returnForCorrections(
    request: RenewalRequest
  ) {
    const reason = window.prompt(
      "Describe the corrections the user must make:"
    );

    if (!reason?.trim()) return;

    setProcessingId(request.renewal_request_id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase.rpc(
        "admin_return_account_renewal",
        {
          p_renewal_request_id:
            request.renewal_request_id,
          p_reason: reason.trim(),
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      let correctionsMessage =
        "Renewal returned for corrections.";

      try {
        await sendRenewalEmail(
          "corrections_required",
          request.renewal_request_id
        );

        correctionsMessage +=
          " Corrections email sent.";
      } catch (emailError) {
        correctionsMessage +=
          ` The request was returned, but the corrections email could not be sent: ${
            emailError instanceof Error
              ? emailError.message
              : "Unknown email error."
          }`;
      }

      setSuccessMessage(correctionsMessage);

      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to return renewal."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function denyRenewal(request: RenewalRequest) {
    const reason = window.prompt(
      "Enter the reason this renewal is being denied:"
    );

    if (!reason?.trim()) return;

    const confirmed = window.confirm(
      "Deny this renewal request? The account history will be preserved."
    );

    if (!confirmed) return;

    setProcessingId(request.renewal_request_id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase.rpc(
        "admin_deny_account_renewal",
        {
          p_renewal_request_id:
            request.renewal_request_id,
          p_reason: reason.trim(),
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      let denialMessage =
        "Renewal request denied.";

      try {
        await sendRenewalEmail(
          "denied",
          request.renewal_request_id
        );

        denialMessage +=
          " Denial email sent.";
      } catch (emailError) {
        denialMessage +=
          ` The request was denied, but the denial email could not be sent: ${
            emailError instanceof Error
              ? emailError.message
              : "Unknown email error."
          }`;
      }

      setSuccessMessage(denialMessage);
      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to deny renewal."
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="access-account-management">
      <section className="access-accounts-workspace">
        <Card title="Account Renewal Requests">
          <div className="account-toolbar">
            <input
              aria-label="Search renewal requests"
              placeholder="Search by name, Access ID, email, phone, or organization"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <button
              className="button secondary"
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              className="button secondary"
              href="/admin/access-accounts"
            >
              Back to Accounts
            </Link>
          </div>

          <div className="filter-chip-row">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                className={`filter-chip ${
                  statusFilter === status ? "active" : ""
                }`}
                type="button"
                onClick={() => setStatusFilter(status)}
              >
                {formatStatus(status)}
              </button>
            ))}
          </div>

          {successMessage && (
            <div className="success-callout">
              <strong>Action completed</strong>
              <p>{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="error-callout">
              <strong>Unable to complete action</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {loading && (
            <p className="muted-text">
              Loading renewal requests...
            </p>
          )}

          {!loading &&
            filteredRequests.length === 0 && (
              <p className="muted-text">
                No renewal requests match this filter.
              </p>
            )}

          {!loading &&
            filteredRequests.length > 0 && (
              <div className="access-account-name-list">
                {filteredRequests.map((request) => {
                  const isSelected =
                    request.renewal_request_id ===
                    selected?.renewal_request_id;

                  return (
                    <button
                      key={request.renewal_request_id}
                      type="button"
                      className={`access-account-name-row ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() =>
                        setSelectedId(
                          request.renewal_request_id
                        )
                      }
                    >
                      <div className="access-account-name-main">
                        <strong>
                          {request.first_name}{" "}
                          {request.last_name}
                        </strong>

                        <span>
                          Access ID{" "}
                          {request.access_id || "—"}
                        </span>
                      </div>

                      <div className="access-account-status-cell">
                        <StatusBadge
                          label={formatStatus(
                            request.renewal_status
                          )}
                          tone={getTone(
                            request.renewal_status
                          )}
                        />
                      </div>

                      <small>
                        Expires{" "}
                        {formatDate(
                          request.current_expiration_date
                        )}
                      </small>

                      <small>
                        Submitted{" "}
                        {formatDateTime(
                          request.submitted_at
                        )}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
        </Card>

        <div className="account-profile-column">
          {!selected ? (
            <Card title="Renewal Review">
              <p className="muted-text">
                Select a renewal request to review it.
              </p>
            </Card>
          ) : (
            <>
              <Card title="Renewal Review">
                <div className="profile-header-row">
                  <div>
                    <h2>
                      {selected.first_name}{" "}
                      {selected.last_name}
                    </h2>

                    <p>
                      Access ID {selected.access_id || "—"}
                    </p>
                  </div>

                  <StatusBadge
                    label={formatStatus(
                      selected.renewal_status
                    )}
                    tone={getTone(
                      selected.renewal_status
                    )}
                  />
                </div>

                <div className="profile-metric-grid">
                  <div>
                    <span>Account Status</span>
                    <strong>
                      {formatStatus(
                        selected.account_status
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Current Expiration</span>
                    <strong>
                      {formatDate(
                        selected.current_expiration_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Proposed Expiration</span>
                    <strong>
                      {formatDate(
                        selected.proposed_expiration_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Rules Version</span>
                    <strong>
                      {selected.rules_version || "—"}
                    </strong>
                  </div>
                </div>
              </Card>

              <Card title="Submitted Information">
                <div className="profile-detail-list">
                  <div>
                    <span>Email</span>
                    <strong>{selected.email || "—"}</strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>{selected.phone || "—"}</strong>
                  </div>

                  <div>
                    <span>Mailing Address</span>
                    <strong>
                      {selected.mailing_address || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Organization</span>
                    <strong>
                      {selected.organization || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Gate Code Device</span>
                    <strong>
                      {formatDeviceType(
                        selected.device_type as any
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Preferred Gate</span>
                    <strong>
                      {selected.default_gate || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Emergency Contact</span>
                    <strong>
                      {selected.emergency_contact_name ||
                        "—"}{" "}
                      {selected.emergency_contact_phone ||
                        ""}
                    </strong>
                  </div>

                  <div>
                    <span>ID Document</span>
                    <strong>
                      {selected.id_document_path
                        ? "Document on file"
                        : "No document path recorded"}
                    </strong>
                  </div>

                  <div>
                    <span>User Comments</span>
                    <strong>
                      {selected.user_comments || "—"}
                    </strong>
                  </div>
                </div>
              </Card>

              {(selected.corrections_required_reason ||
                selected.denial_reason ||
                selected.admin_comments) && (
                <Card title="Review Notes">
                  <div className="profile-detail-list">
                    {selected
                      .corrections_required_reason && (
                      <div>
                        <span>
                          Corrections Required
                        </span>
                        <strong>
                          {
                            selected.corrections_required_reason
                          }
                        </strong>
                      </div>
                    )}

                    {selected.denial_reason && (
                      <div>
                        <span>Denial Reason</span>
                        <strong>
                          {selected.denial_reason}
                        </strong>
                      </div>
                    )}

                    {selected.admin_comments && (
                      <div>
                        <span>Admin Comments</span>
                        <strong>
                          {selected.admin_comments}
                        </strong>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card title="Renewal Actions">
                <div className="quick-action-button-grid">
                  <Link
                    className="button secondary"
                    href={`/admin/access-accounts/${selected.access_account_id}`}
                  >
                    View Full Profile
                  </Link>

                  {selected.renewal_status ===
                    "pending" && (
                    <>
                      <button
                        className="button primary"
                        type="button"
                        disabled={
                          processingId ===
                          selected.renewal_request_id
                        }
                        onClick={() =>
                          void approveRenewal(selected)
                        }
                      >
                        {processingId ===
                        selected.renewal_request_id
                          ? "Processing..."
                          : "Approve Renewal"}
                      </button>

                      <button
                        className="button secondary"
                        type="button"
                        disabled={
                          processingId ===
                          selected.renewal_request_id
                        }
                        onClick={() =>
                          void returnForCorrections(
                            selected
                          )
                        }
                      >
                        Return for Corrections
                      </button>

                      <button
                        className="button danger"
                        type="button"
                        disabled={
                          processingId ===
                          selected.renewal_request_id
                        }
                        onClick={() =>
                          void denyRenewal(selected)
                        }
                      >
                        Deny Renewal
                      </button>
                    </>
                  )}

                  {selected.renewal_status ===
                    "corrections_required" && (
                    <button
                      className="button danger"
                      type="button"
                      disabled={
                        processingId ===
                        selected.renewal_request_id
                      }
                      onClick={() =>
                        void denyRenewal(selected)
                      }
                    >
                      Deny Renewal
                    </button>
                  )}
                </div>

                <p
                  className="muted-text"
                  style={{ marginTop: 12 }}
                >
                  Approval applies the submitted information,
                  retains the existing Access ID, and extends
                  the account expiration date.
                </p>
              </Card>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
