"use client";

import dynamic from "next/dynamic";

const AccessAccountWizard = dynamic(
  () => import("../../components/account/AccessAccountWizard"),
  {
    ssr: false,
    loading: () => <p>Loading account request form...</p>,
  }
);

export default function RequestAccountPage() {
  return <AccessAccountWizard />;
}