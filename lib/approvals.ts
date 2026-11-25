import { invoiceWorkflow, type InvoiceStatus, type Role } from "@/config/workflows";
import type { Approval, Invoice } from "@/lib/types";

export type ApprovalStep = { overAmount: number; role: Role };

/** Approval steps an invoice of this size needs, from config/workflows.ts. */
export function requiredApprovals(totalCents: number): ApprovalStep[] {
  const amount = Math.abs(totalCents);
  if (amount < invoiceWorkflow.autoApproveUnder * 100) return [];
  return (invoiceWorkflow.approvals as readonly { overAmount: number; role: string }[])
    .filter((s) => amount > s.overAmount * 100)
    .map((s) => ({ overAmount: s.overAmount, role: s.role as Role }));
}

/** Steps not yet signed off. */
export function pendingApprovals(inv: Pick<Invoice, "totalCents" | "approvals">): ApprovalStep[] {
  return requiredApprovals(inv.totalCents).filter((step) => !inv.approvals.some((a) => a.role === step.role));
}

/** Owners can sign any step; everyone else only their own role's step. */
export function canApproveStep(userRole: Role, step: ApprovalStep): boolean {
  return userRole === "owner" || userRole === step.role;
}

export type ConfirmCheck = { ok: true } | { ok: false; reason: string };

/** Checks before a human can confirm extracted invoice data. */
export function checkConfirm(inv: Pick<Invoice, "jobId" | "vendorName" | "totalCents">): ConfirmCheck {
  if (!inv.vendorName?.trim()) return { ok: false, reason: "Add the supplier name." };
  if (invoiceWorkflow.requireJobBeforeApproval && !inv.jobId) {
    return { ok: false, reason: "Pick the job this invoice belongs to." };
  }
  return { ok: true };
}

/** Status after a human confirms the AI-extracted fields, or after an approval is added. */
export function statusAfterReview(inv: Pick<Invoice, "totalCents" | "approvals">): InvoiceStatus {
  return pendingApprovals(inv).length === 0 ? "Approved" : "Needs review";
}

/** Sign the first pending step this user is allowed to sign. Returns null if none. */
export function addApproval(
  inv: Pick<Invoice, "totalCents" | "approvals">,
  userId: string,
  userRole: Role,
  now = new Date().toISOString(),
): Approval[] | null {
  const step = pendingApprovals(inv).find((s) => canApproveStep(userRole, s));
  if (!step) return null;
  return [...inv.approvals, { role: step.role, userId, at: now }];
}

export const OPEN_STATUSES: InvoiceStatus[] = ["Approved", "Scheduled"];
export const INBOX_STATUSES: InvoiceStatus[] = ["Received", "Needs review"];
