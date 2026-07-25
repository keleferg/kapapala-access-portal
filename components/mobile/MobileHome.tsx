"use client";
import Link from "next/link";
import AccessCard from "@/components/dashboard/AccessCard";
import NextTripCard from "@/components/dashboard/NextTripCard";
import GateStatusSection from "@/components/dashboard/GateStatusSection";
import NoticesCard from "@/components/dashboard/NoticesCard";
import RenewalStatusCard from "@/components/dashboard/RenewalStatusCard";

export default function MobileHome() {
  return <>
    <section className="mobile-hero">
      <p>Public Access</p><h2>Plan your next visit.</h2>
      <span>Request access, review trip status, and retrieve eligible gate information.</span>
      <Link href="/mobile/new-request" className="mobile-primary-action">Request Access</Link>
    </section>
    <div className="mobile-card-stack"><AccessCard /><NextTripCard /><RenewalStatusCard /></div>
    <GateStatusSection />
    <div className="mobile-card-stack"><NoticesCard /></div>
  </>;
}
