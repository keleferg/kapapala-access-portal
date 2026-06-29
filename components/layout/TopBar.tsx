import StatusBadge from "../ui/StatusBadge";
import AuthStatus from "../auth/AuthStatus";

export default function TopBar() {
  return (
    <header className="topbar">
      <div>
        <h1>Kapāpala Access Portal</h1>
        <p>Public Access Management System</p>
      </div>

      <div className="topbar-right">
        <StatusBadge label="Public Access Open" tone="green" />
        <AuthStatus />
      </div>
    </header>
  );
}
