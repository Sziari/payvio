import Link from "next/link";
import { navigation } from "@/config/navigation";
import { features } from "@/config/features";
import { requireContext } from "@/lib/data/context";
import { INBOX_STATUSES } from "@/lib/approvals";
import { Sidebar } from "@/components/layout/sidebar";
import { signOut } from "@/app/(auth)/actions";

// Pages that only show when their feature switch in config/features.ts is on.
const FEATURE_PAGES: Record<string, boolean> = {
  "/payapps": features.payApps,
};

// Always render fresh: every page shows the signed-in company's live data.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { repo, user } = await requireContext();
  const [company, invoices] = await Promise.all([repo.getCompany(), repo.listInvoices()]);
  const inboxCount = invoices.filter((i) => INBOX_STATUSES.includes(i.status)).length;
  const items = navigation.filter((n) => n.show && FEATURE_PAGES[n.href] !== false);

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        companyName={company.name}
        userEmail={user.email}
        inboxCount={inboxCount}
        darkModeEnabled={features.darkMode}
        signOut={repo.mode === "live" ? signOut : undefined}
      />
      <div className="lg:pl-60">
        {repo.mode === "demo" && (
          <div className="border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-xs sm:text-sm">
            Demo mode: you are looking at sample data, and changes reset when the app restarts.{" "}
            <Link href="/settings/connections" className="font-semibold underline">
              How to go live
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
