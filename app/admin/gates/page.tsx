import AppShell from "../../../components/layout/AppShell";
import GateCombinationManager from "../../../components/admin/GateCombinationManager";

export default function GatesPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Gate Combinations</h2>
        <span>
          Manage daily combinations, gate status, road conditions, and gate-specific notices.
        </span>
      </div>

      <GateCombinationManager />
    </AppShell>
  );
}
