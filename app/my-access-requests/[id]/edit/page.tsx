import AppShell from "../../../../components/layout/AppShell";
import EditAccessRequestForm from "../../../../components/access/EditAccessRequestForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAccessRequestPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="page-heading">
        <p>Access</p>

        <h2>Edit Access Request</h2>

        <span>
          Update your pending access request so it can be reviewed again.
        </span>
      </div>

      <EditAccessRequestForm requestId={id} />
    </AppShell>
  );
}