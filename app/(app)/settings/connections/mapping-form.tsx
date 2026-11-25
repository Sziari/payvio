"use client";

import { useState, useTransition } from "react";
import { Button, Field, Select } from "@/components/ui";
import type { QboAccount } from "@/lib/integrations/quickbooks";
import { ResultNotice } from "./connect-buttons";
import type { Result } from "./actions";

export function MappingForm({
  accounts,
  mapping,
  costTypes,
  action,
  disabled,
}: {
  accounts: QboAccount[];
  mapping: Record<string, string>;
  costTypes: string[];
  action: (form: FormData) => Promise<Result>;
  disabled: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const options = (
    <>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.type})
        </option>
      ))}
    </>
  );
  return (
    <form action={(fd) => start(async () => setResult(await action(fd)))} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Default account">
        <Select name="acct:default" defaultValue={mapping.default ?? ""} disabled={disabled}>
          <option value="">Pick an account...</option>
          {options}
        </Select>
      </Field>
      {costTypes.map((t) => (
        <Field key={t} label={t}>
          <Select name={`acct:${t}`} defaultValue={mapping[t] ?? ""} disabled={disabled}>
            <option value="">Use default</option>
            {options}
          </Select>
        </Field>
      ))}
      <div className="sm:col-span-2 lg:col-span-3">
        <Button variant="outline" disabled={pending || disabled}>
          Save accounts
        </Button>
        <ResultNotice result={result} />
      </div>
    </form>
  );
}
