import type { Invoice } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

function normNumber(n: string | null | undefined) {
  return (n ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "");
}

/** Another invoice with the same supplier and invoice number (ignores spaces, dashes, leading zeros). */
export function findDuplicate(
  inv: Pick<Invoice, "id" | "vendorId" | "vendorName" | "invoiceNumber">,
  all: Pick<Invoice, "id" | "vendorId" | "vendorName" | "invoiceNumber">[],
): Pick<Invoice, "id"> | null {
  const num = normNumber(inv.invoiceNumber);
  if (!num) return null;
  const vendor = normalizeText(inv.vendorName);
  return (
    all.find(
      (o) =>
        o.id !== inv.id &&
        normNumber(o.invoiceNumber) === num &&
        ((inv.vendorId && o.vendorId === inv.vendorId) || (vendor && normalizeText(o.vendorName) === vendor)),
    ) ?? null
  );
}
