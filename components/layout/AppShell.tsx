import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

type AppShellProps = {
  children: React.ReactNode;
  variant?: "default" | "admin";
};

export default function AppShell({
  children,
  variant = "default",
}: AppShellProps) {
  const isAdmin = variant === "admin";

  return (
    <div className={`app-shell${isAdmin ? " app-shell--admin" : ""}`}>
      <Sidebar />

      <main className="main">
        <TopBar variant={variant} />
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
