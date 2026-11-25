// Controls the steps an invoice goes through and who approves it.
export const invoiceWorkflow = {
  statuses: ["Received", "Needs review", "Approved", "Scheduled", "Paid", "Disputed"] as const,
  autoApproveUnder: 500, // dollars; below this, skip approval
  approvals: [
    { overAmount: 500, role: "office_manager" },
    { overAmount: 5000, role: "owner" },
  ],
  requireJobBeforeApproval: true,
  flagFinanceCharges: true, // highlight late fees from suppliers
  earlyPayDiscountAlertDays: 3, // warn before a 1-2% discount expires
};

export type InvoiceStatus = (typeof invoiceWorkflow.statuses)[number];

export const roles = ["owner", "office_manager", "project_manager", "estimator"] as const;
export type Role = (typeof roles)[number];

export const costTypes = [
  "Material",
  "Trucking",
  "Equipment rental",
  "Labor",
  "Subcontract",
  "Finance charge",
  "Other",
] as const;
export type CostType = (typeof costTypes)[number];
