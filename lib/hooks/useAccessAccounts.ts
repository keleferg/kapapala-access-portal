"use client";

import { useEffect, useState } from "react";

export type AppRole = "user" | "admin" | "super_user";

export type AccessAccount = {
  id: string;
  access_id: string | null;
  profile_id?: string | null;
  status: string;
  app_role: AppRole;
  account_type: string;
  organization: string | null;
  default_gate: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
  applicant_first_name?: string | null;
  applicant_last_name?: string | null;
  applicant: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  reviewer: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  vehicles: {
    id: string;
    label: string;
    license_plate: string;
    state: string;
    make: string | null;
    model: string | null;
    color: string | null;
    is_default: boolean;
  }[];
};

export function useAccessAccounts() {
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/access-accounts");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load access accounts.");
      }

      const normalizedAccounts: AccessAccount[] = (result.accounts ?? []).map(
        (account: Partial<AccessAccount>) => ({
          ...account,
          app_role: account.app_role ?? "user",
          vehicles: account.vehicles ?? [],
        })
      ) as AccessAccount[];

      setAccounts(normalizedAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  return {
    accounts,
    loading,
    error,
    refresh: loadAccounts,
  };
}