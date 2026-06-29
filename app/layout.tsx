import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kapāpala Access Portal",
  description: "Public Access Management System for Kapāpala Ranch",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
