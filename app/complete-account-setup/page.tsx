"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExistingAccountSetupWizard from "../../components/access-account/ExistingAccountSetupWizard";
import { getSupabaseClient } from "../../lib/supabaseClient";
import type { DeviceType } from "../../lib/deviceTypeOptions";

type GateName = "Wood Valley" | "Honanui" | "ʻĀinapō";

type ExistingAccount = {
  id: string;
  access_id: string | null;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  mailing_address: string | null;
  organization: string | null;
  device_type: DeviceType | null;
  default_gate: GateName | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  id_document_path: string | null;
  setup_version: number;
  setup_completed_at: string | null;
  id_is_valid: boolean;
  id_status_message: string;
};

type AccountRow = {
  id: string;
  access_id: string | null;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  mailing_address: string | null;
  organization: string | null;
  device_type: DeviceType | null;
  default_gate: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  id_document_path: string | null;
  setup_version: number | null;
  setup_completed_at: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function normalizeGate(value: string | null): GateName | null {
  if (
    value === "Wood Valley" ||
    value === "Honanui" ||
    value === "ʻĀinapō"
  ) {
    return value;
  }

  return null;
}

function normalizeAccount(data: AccountRow): ExistingAccount {
  return {
    id: data.id,
    access_id: data.access_id,
    applicant_first_name:
      data.applicant_first_name || data.profiles?.first_name || null,
    applicant_last_name:
      data.applicant_last_name || data.profiles?.last_name || null,
    applicant_email:
      data.applicant_email || data.profiles?.email || null,
    applicant_phone:
      data.applicant_phone || data.profiles?.phone || null,
    mailing_address: data.mailing_address,
    organization: data.organization,
    device_type: data.device_type,
    default_gate: normalizeGate(data.default_gate),
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
    id_document_path: data.id_document_path,
    setup_version: data.setup_version ?? 0,
    setup_completed_at: data.setup_completed_at,
    id_is_valid: false,
    id_status_message:
      "The identification document on file could not be validated.",
  };
}

export default function CompleteAccountSetupPage() {
  const router = useRouter();

  const [account, setAccount] = useState<ExistingAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      try {
        const supabase = getSupabaseClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("access_accounts")
          .select(
            `
              id,
              access_id,
              applicant_first_name,
              applicant_last_name,
              applicant_email,
              applicant_phone,
              mailing_address,
              organization,
              device_type,
              default_gate,
              emergency_contact_name,
              emergency_contact_phone,
              id_document_path,
              setup_version,
              setup_completed_at,
              profiles!access_accounts_profile_id_fkey (
                first_name,
                last_name,
                email,
                phone
              )
            `
          )
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          if (isMounted) {
            setLoadError(
              "We could not find an access account connected to your login."
            );
          }
          return;
        }

        const normalizedAccount = normalizeAccount(data as AccountRow);

        const { data: idStatusData, error: idStatusError } =
          await (supabase as any).rpc(
            "get_my_access_account_id_status",
            {
              p_access_account_id: normalizedAccount.id,
            }
          );

        if (idStatusError) {
          throw new Error(idStatusError.message);
        }

        const idStatus = Array.isArray(idStatusData)
          ? idStatusData[0]
          : idStatusData;

        normalizedAccount.id_is_valid =
          idStatus?.is_valid === true;

        normalizedAccount.id_status_message =
          idStatus?.status_message ||
          "The identification document on file could not be validated.";

        if (normalizedAccount.setup_version >= 2) {
          router.replace("/dashboard");
          return;
        }

        if (isMounted) {
          setAccount(normalizedAccount);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your access account."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isLoading) {
    return (
      <main className="page-shell">
        <div className="info-callout">
          <strong>Loading account setup</strong>
          <p>Please wait while we retrieve your existing access account.</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-shell">
        <div className="error-callout">
          <strong>Unable to load account setup</strong>
          <p>{loadError}</p>
        </div>
      </main>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <main className="page-shell">
      <ExistingAccountSetupWizard account={account} />
    </main>
  );
}
