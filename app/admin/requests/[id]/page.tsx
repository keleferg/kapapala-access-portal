import AppShell from "../../../../components/layout/AppShell";
import DailyAccessRequestDetail from "../../../../components/admin/DailyAccessRequestDetail";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminDailyAccessRequestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>

        <h2>Daily Access Request Detail</h2>

        <span>
          Review the full request details before approving or denying access.
        </span>
      </div>

      <DailyAccessRequestDetail requestId={id} />
    </AppShell>
  );
}