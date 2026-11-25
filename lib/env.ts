// Reads environment variables in one place. Server-only values are never sent to the browser.

export const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Which outside services have their keys set. Used to show friendly "setup needed" messages. */
export function setupStatus() {
  return {
    supabase: !isDemo,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    plaid: !!process.env.PLAID_CLIENT_ID && !!process.env.PLAID_SECRET,
    plaidEnv: (process.env.PLAID_ENV || "sandbox") as "sandbox" | "production",
    quickbooks: !!process.env.INTUIT_CLIENT_ID && !!process.env.INTUIT_CLIENT_SECRET,
    quickbooksEnv: (process.env.INTUIT_ENVIRONMENT || "sandbox") as "sandbox" | "production",
    encryption: !!process.env.TOKEN_ENCRYPTION_KEY || isDemo,
    inboundEmail: !!process.env.INBOUND_EMAIL_SECRET && !!process.env.INBOUND_EMAIL_DOMAIN,
    inboundDomain: process.env.INBOUND_EMAIL_DOMAIN || null,
  };
}
export type SetupStatus = ReturnType<typeof setupStatus>;
