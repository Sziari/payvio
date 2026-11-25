"use client";

import Link from "next/link";
import { useActionState } from "react";
import { costTypes } from "@/config/workflows";
import { Button, Card, CardHeader, Field, Input, Notice } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import type { Job } from "@/lib/types";
import { saveJob } from "./actions";

export function JobForm({ job }: { job?: Job }) {
  const [state, action, pending] = useActionState(saveJob, undefined);
  return (
    <form action={action} className="space-y-6">
      {job && <input type="hidden" name="id" value={job.id} />}
      <Card>
        <CardHeader title="Job details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Job name" className="sm:col-span-2">
            <Input name="name" defaultValue={job?.name} placeholder="Dixon Warehouse Slab" required />
          </Field>
          <Field label="Job number" hint="Suppliers often print this on invoices. It helps match them.">
            <Input name="jobNumber" defaultValue={job?.jobNumber ?? ""} placeholder="2401" />
          </Field>
          <Field label="GC / customer">
            <Input name="customer" defaultValue={job?.customer ?? ""} placeholder="Westbrook Builders" />
          </Field>
          <Field label="Job address" hint="Used to match supplier invoices by ship-to address.">
            <Input name="address" defaultValue={job?.address ?? ""} placeholder="2700 Plaza Ct" />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={job?.city ?? ""} placeholder="Dixon" />
          </Field>
          <Field label="Contract amount ($)">
            <Input name="contract" inputMode="decimal" defaultValue={centsToInput(job?.contractCents)} placeholder="185000" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Budget by cost type" description="Leave blank if you don't budget that cost type." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {costTypes.map((t) => (
            <Field key={t} label={`${t} ($)`}>
              <Input name={`budget:${t}`} inputMode="decimal" defaultValue={centsToInput(job?.budgets[t])} />
            </Field>
          ))}
        </div>
      </Card>

      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex gap-2">
        <Button disabled={pending}>{pending ? "Saving..." : job ? "Save changes" : "Add job"}</Button>
        <Link href={job ? `/jobs/${job.id}` : "/jobs"} className="inline-flex h-10 items-center px-3 text-sm text-muted">
          Cancel
        </Link>
      </div>
    </form>
  );
}
