import AppShell from "@/components/layout/AppShell";
import AccessAccountManagement from "@/components/admin/AccessAccountManagement";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AccessAccountReviewPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">
          Access Account Review
        </h1>
        <p className="mt-2 text-white/80">
          Review and manage this access account.
        </p>
      </div>

      <AccessAccountManagement accountId={id} />
    </AppShell>
  );
}