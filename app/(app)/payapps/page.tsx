import { notFound } from "next/navigation";
import { features } from "@/config/features";
import { EmptyState, Card, PageHeader } from "@/components/ui";

// Placeholder. Turn on with payApps: true in config/features.ts once it's built.
export default function PayAppsPage() {
  if (!features.payApps) notFound();
  return (
    <>
      <PageHeader title="Pay Apps" />
      <Card>
        <EmptyState title="Coming soon">Progress billing (AIA G702/G703 style) will live here.</EmptyState>
      </Card>
    </>
  );
}
