"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { disconnect, finishPlaidLink, getPlaidLinkToken, setAccountIncluded, syncBank, type Result } from "./actions";

export function ResultNotice({ result }: { result: Result | null }) {
  if (!result) return null;
  return (
    <Notice tone={result.ok ? "success" : "danger"} className="mt-3">
      {result.ok ? (result.message ?? "Done.") : result.error}
    </Notice>
  );
}

/** Opens Plaid Link: the person picks their bank and signs in on Plaid's screen (we never see the password). */
export function PlaidConnectButton({ reconnectId, label }: { reconnectId?: string; label?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, start] = useTransition();

  const onSuccess = useCallback(
    (publicToken: string | null, metadata: { institution?: { name?: string } | null }) => {
      start(async () => {
        if (!publicToken && !reconnectId) {
          setResult({ ok: false, error: "The bank didn't finish connecting. Try again." });
          setToken(null);
          return;
        }
        // In reconnect mode the token is already valid; just refresh.
        const r = reconnectId ? await syncBank() : await finishPlaidLink(publicToken!, metadata.institution?.name ?? null);
        setResult(r);
        setToken(null);
      });
    },
    [reconnectId],
  );

  const { open, ready } = usePlaidLink({ token, onSuccess, onExit: () => setToken(null) });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  return (
    <div>
      <Button
        size={reconnectId ? "sm" : "lg"}
        variant={reconnectId ? "outline" : "primary"}
        disabled={busy || !!token}
        onClick={() =>
          start(async () => {
            setResult(null);
            const r = await getPlaidLinkToken(reconnectId);
            if (r.ok && r.linkToken) setToken(r.linkToken);
            else setResult(r);
          })
        }
      >
        {busy || token ? <Loader2 className="animate-spin" /> : <Landmark />}
        {label ?? "Connect your bank"}
      </Button>
      <ResultNotice result={result} />
    </div>
  );
}

export function ActionButton({
  action,
  children,
  variant = "outline",
  confirmText,
  icon,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  variant?: "outline" | "primary" | "ghost" | "danger";
  confirmText?: string;
  icon?: "sync" | "unplug";
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, start] = useTransition();
  return (
    <div>
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setResult(await action()));
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : icon === "sync" ? <RefreshCw /> : icon === "unplug" ? <Unplug /> : null}
        {children}
      </Button>
      <ResultNotice result={result} />
    </div>
  );
}

export function DisconnectButton({ id, name }: { id: string; name: string }) {
  return (
    <ActionButton
      action={() => disconnect(id)}
      variant="ghost"
      icon="unplug"
      confirmText={`Disconnect ${name}? Payvio will stop getting updates. You can connect again any time.`}
    >
      Disconnect
    </ActionButton>
  );
}

export function SyncBankButton() {
  return (
    <ActionButton action={syncBank} icon="sync">
      Update now
    </ActionButton>
  );
}

export function IncludeToggle({ id, included }: { id: string; included: boolean }) {
  const [on, setOn] = useState(included);
  const [, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          start(async () => {
            await setAccountIncluded(id, e.target.checked);
          });
        }}
      />
      Count as cash
    </label>
  );
}
