import AppShell from "../../../../../components/layout/AppShell";
import AccessAccountTrips from "../../../../../components/admin/AccessAccountTrips";

export default async function AccessAccountTripsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <AccessAccountTrips accountId={id} />
    </AppShell>
  );
}