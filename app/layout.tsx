import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kapāpala Forest Reserve Access Portal",
  description: "Kapapala Forest Reserve Access Management System for Kapāpala Ranch",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
