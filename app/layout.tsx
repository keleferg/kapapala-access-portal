import type { Metadata } from "next";
import ExistingAccountSetupGuard from "../components/auth/ExistingAccountSetupGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kapāpala Forest Reserve Access Portal",
  description:
    "Kapāpala Forest Reserve Access Management System for Kapāpala Ranch",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ExistingAccountSetupGuard />
        {children}
      </body>
    </html>
  );
}
