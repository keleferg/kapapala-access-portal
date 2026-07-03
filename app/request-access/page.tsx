import AppShell from "../../components/layout/AppShell";
import DailyAccessRequestWizard from "../../components/access/DailyAccessRequestWizard";

export default function RequestAccessPage() {
  return (
    <AppShell>
      <DailyAccessRequestWizard />
    </AppShell>
  );
}