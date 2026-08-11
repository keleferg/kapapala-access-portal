import AppShell from "@/components/layout/AppShell";
import AuthGuard from "@/components/auth/AuthGuard";
import MyAccessAccountPage from "@/components/account/MyAccessAccountPage";

export default function MyAccountPage() {
  return (
    <AuthGuard mode="user">
      <AppShell>
        <MyAccessAccountPage />
      </AppShell>
    </AuthGuard>
  );
}
