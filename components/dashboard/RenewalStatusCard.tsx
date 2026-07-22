"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type RenewalEligibility = {
  access_account_id: string;
  account_status: string;
  expires_at: string | null;
  current_hawaii_date: string;
  renewal_window_start: string | null;
  is_eligible: boolean;
  eligibility_reason: string;
  open_renewal_request_id: string | null;
  open_renewal_request_status: string | null;
};

type RenewalRecord = {
  id: string;
  status: string;
  proposed_expiration_date: string | null;
  corrections_required_reason: string | null;
  denial_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  denied_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return value;

  return `${month}/${day}/${year}`;
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusTone(
  status: string
): "green" | "yellow" | "red" {
  if (status === "approved") return "green";

  if (
    status === "pending" ||
    status === "corrections_required"
  ) {
    return "yellow";
  }

  return "red";
}

export default function RenewalStatusCard() {
  const [eligibility, setEligibility] =
    useState<RenewalEligibility | null>(null);

  const [latestRenewal, setLatestRenewal] =
    useState<RenewalRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRenewalStatus() {
      try {
        const supabase = getSupabaseClient() as any;

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          return;
        }

        const {
          data: account,
          error: accountError,
        } = await supabase
          .from("access_accounts")
          .select("id")
          .eq("profile_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (accountError) {
          throw new Error(accountError.message);
        }

        if (!account?.id) {
          return;
        }

        const {
          data: eligibilityData,
          error: eligibilityError,
        } = await supabase.rpc(
          "get_access_account_renewal_eligibility",
          {
            p_access_account_id: account.id,
          }
        );

        if (eligibilityError) {
          throw new Error(eligibilityError.message);
        }

        const eligibilityRow =
          Array.isArray(eligibilityData)
            ? eligibilityData[0]
            : eligibilityData;

        const {
          data: renewalData,
          error: renewalError,
        } = await supabase
          .from("access_account_renewal_requests")
          .select(`
            id,
            status,
            proposed_expiration_date,
            corrections_required_reason,
            denial_reason,
            submitted_at,
            approved_at,
            denied_at
          `)
          .eq("access_account_id", account.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        /*
         * Direct table reads may be blocked by RLS.
         * Eligibility still provides the active open-request status,
         * which is enough for the most important dashboard states.
         */
        if (!cancelled) {
          setEligibility(
            eligibilityRow || null
          );

          if (!renewalError) {
            setLatestRenewal(
              renewalData || null
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load renewal status."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRenewalStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card title="Account Renewal">
        <p className="muted-text">
          Loading renewal status...
        </p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card title="Account Renewal">
        <p className="muted-text">
          Renewal status is temporarily unavailable.
        </p>
      </Card>
    );
  }

  if (!eligibility) {
    return (
      <Card title="Account Renewal">
        <p className="muted-text">
          No access account was found for this login.
        </p>
      </Card>
    );
  }

  const openStatus =
    eligibility.open_renewal_request_status;

  const displayedStatus =
    openStatus ||
    latestRenewal?.status ||
    "";

  const correctionsReason =
    latestRenewal?.corrections_required_reason;

  const denialReason =
    latestRenewal?.denial_reason;

  if (openStatus === "pending") {
    return (
      <Card title="Account Renewal">
        <StatusBadge
          label="Pending Review"
          tone="yellow"
        />

        <p style={{ marginTop: 12 }}>
          Your renewal request has been submitted and is
          awaiting administrative review.
        </p>

        <p className="muted-text">
          Current expiration:{" "}
          {formatDate(eligibility.expires_at)}
        </p>
      </Card>
    );
  }

  if (openStatus === "corrections_required") {
    return (
      <Card title="Account Renewal">
        <StatusBadge
          label="Corrections Required"
          tone="yellow"
        />

        <p style={{ marginTop: 12 }}>
          Your renewal needs additional or corrected
          information before it can be approved.
        </p>

        {correctionsReason && (
          <div className="info-callout warning">
            <strong>Requested correction</strong>
            <p>{correctionsReason}</p>
          </div>
        )}

        <Link
          className="button primary"
          href="/complete-account-setup?mode=renewal"
        >
          Correct Renewal Request
        </Link>
      </Card>
    );
  }

  if (displayedStatus === "approved") {
    return (
      <Card title="Account Renewal">
        <StatusBadge
          label="Renewal Approved"
          tone="green"
        />

        <p style={{ marginTop: 12 }}>
          Your access account renewal has been approved.
        </p>

        <p className="muted-text">
          Expiration date:{" "}
          {formatDate(
            latestRenewal?.proposed_expiration_date ||
              eligibility.expires_at
          )}
        </p>
      </Card>
    );
  }

  if (displayedStatus === "denied") {
    return (
      <Card title="Account Renewal">
        <StatusBadge
          label="Renewal Denied"
          tone="red"
        />

        <p style={{ marginTop: 12 }}>
          Your most recent renewal request was not approved.
        </p>

        {denialReason && (
          <div className="error-callout">
            <strong>Reason</strong>
            <p>{denialReason}</p>
          </div>
        )}
      </Card>
    );
  }

  if (eligibility.is_eligible) {
    return (
      <Card title="Account Renewal">
        <StatusBadge
          label="Renewal Available"
          tone="yellow"
        />

        <p style={{ marginTop: 12 }}>
          {eligibility.eligibility_reason}
        </p>

        <Link
          className="button primary"
          href="/complete-account-setup?mode=renewal"
        >
          Renew Now
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Account Renewal">
      <StatusBadge
        label={formatStatus(
          eligibility.account_status
        )}
        tone={
          eligibility.account_status === "active"
            ? "green"
            : "red"
        }
      />

      <div
        className="profile-detail-list"
        style={{ marginTop: 12 }}
      >
        <div>
          <span>Account Expiration</span>
          <strong>
            {formatDate(eligibility.expires_at)}
          </strong>
        </div>

        <div>
          <span>Renewal Available</span>
          <strong>
            {formatDate(
              eligibility.renewal_window_start
            )}
          </strong>
        </div>
      </div>

      <p className="muted-text">
        {eligibility.eligibility_reason}
      </p>
    </Card>
  );
}
