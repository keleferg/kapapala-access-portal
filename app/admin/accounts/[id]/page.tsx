import AppShell from "../../../../components/layout/AppShell";
import AccessAccountProfile from "../../../../components/admin/AccessAccountProfile";

export default async function AccessAccountProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <AccessAccountProfile accountId={id} />
    </AppShell>
  );
}
