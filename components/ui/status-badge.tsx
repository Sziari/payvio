import type { InvoiceStatus } from "@/config/workflows";
import { Badge } from "@/components/ui";

const TONE: Record<string, "neutral" | "accent" | "success" | "danger" | "primary"> = {
  Received: "neutral",
  "Needs review": "accent",
  Approved: "primary",
  Scheduled: "primary",
  Paid: "success",
  Disputed: "danger",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{status}</Badge>;
}
