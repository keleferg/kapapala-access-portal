import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";

export default function SmsDeliveryLogPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>SMS Delivery Log</h2>
        <span>
          Review outbound text messages, delivery status, failures, and account
          communication history.
        </span>
      </div>

      <Card title="SMS Delivery Log">
        <p className="muted-text">
          SMS delivery records will appear here once the communications module is connected.
        </p>
      </Card>
    </AppShell>
  );
}