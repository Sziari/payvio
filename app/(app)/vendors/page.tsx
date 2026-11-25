import { requireContext } from "@/lib/data/context";
import { isCosted, isOpenPayable } from "@/lib/calc";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { normalizeText } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function VendorsPage() {
  const { repo } = await requireContext();
  const [vendors, invoices] = await Promise.all([repo.listVendors(), repo.listInvoices()]);
  const year = todayISO().slice(0, 4);

  const rows = vendors
    .map((v) => {
      const mine = invoices.filter(
        (i) => i.vendorId === v.id || (!i.vendorId && normalizeText(i.vendorName) === normalizeText(v.name)),
      );
      const open = mine.filter(isOpenPayable);
      return {
        vendor: v,
        openCents: open.reduce((s, i) => s + i.totalCents, 0),
        openCount: open.length,
        oldestDue: open.map((i) => i.dueDate).filter(Boolean).sort()[0] ?? null,
        ytdCents: mine.filter((i) => isCosted(i) && i.invoiceDate?.startsWith(year)).reduce((s, i) => s + i.totalCents, 0),
        financeCents: mine.filter((i) => isCosted(i) && i.isFinanceCharge).reduce((s, i) => s + i.totalCents, 0),
        count: mine.length,
      };
    })
    .sort((a, b) => b.openCents - a.openCents || b.ytdCents - a.ytdCents);

  return (
    <>
      <PageHeader title="Vendors" description="Suppliers are added automatically when their invoices come in." />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No suppliers yet">Upload an invoice and the supplier appears here.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th className="text-right">You owe</Th>
                <Th className="hidden sm:table-cell">Oldest due</Th>
                <Th className="hidden text-right md:table-cell">Spent this year</Th>
                <Th className="hidden text-right lg:table-cell">Invoices</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendor.id}>
                  <Td>
                    <span className="font-medium">{r.vendor.name}</span>
                    <span className="ml-2 inline-flex gap-1">
                      {r.vendor.qboVendorId && <Badge>In QuickBooks</Badge>}
                      {r.financeCents > 0 && <Badge tone="danger">Late fees {formatMoney(r.financeCents)}</Badge>}
                    </span>
                  </Td>
                  <Td className="tabular text-right">
                    {formatMoney(r.openCents)}
                    {r.openCount > 0 && <span className="block text-xs text-muted">{r.openCount} open</span>}
                  </Td>
                  <Td className="hidden whitespace-nowrap sm:table-cell">{formatDate(r.oldestDue)}</Td>
                  <Td className="tabular hidden text-right md:table-cell">{formatMoney(r.ytdCents)}</Td>
                  <Td className="tabular hidden text-right lg:table-cell">{r.count}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
