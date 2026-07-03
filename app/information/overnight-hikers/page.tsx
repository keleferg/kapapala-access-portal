import Card from "@/components/ui/Card";

export default function OvernightHikersInformationPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Card>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">
            Overnight Hiker Information
          </h1>

          <p className="text-sm text-gray-600">
            This page will provide information for users requesting overnight
            hiking access through Kapāpala Ranch.
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Overnight access requirements, safety information, vehicle
            instructions, and gate access procedures will be added here.
          </div>
        </div>
      </Card>
    </main>
  );
}