import StatusBadge from "../ui/StatusBadge";
import AuthStatus from "../auth/AuthStatus";

type TopBarProps = {
  variant?: "default" | "admin";
};

export default function TopBar({ variant = "default" }: TopBarProps) {
  const isAdmin = variant === "admin";

  return (
    <header className={`topbar${isAdmin ? " topbar--admin" : ""}`}>
      <div className="topbar__identity">
        {isAdmin && <span className="topbar__eyebrow">Admin workspace</span>}

        <h1>Kapāpala Access Portal</h1>

        <p>
          {isAdmin
            ? "Forest reserve access operations and administration"
            : "Kapāpala Forest Reserve Access Management System"}
        </p>
      </div>

      <div className="topbar-right">
        <StatusBadge label="Public Access Open" tone="green" />
        <AuthStatus />
      </div>
    </header>
  );
}
