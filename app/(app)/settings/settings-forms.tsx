"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";
import type { Role } from "@/config/workflows";
import type { Company, Member } from "@/lib/types";
import { changeRole, inviteTeammate, loadSampleData, removeTeammate, saveCompanyProfile, type Result } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  office_manager: "Office manager / AP",
  project_manager: "Project manager",
  estimator: "Estimator",
};

function useResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) => start(async () => setResult(await fn()));
  const notice = result && (
    <Notice tone={result.ok ? "success" : "danger"} className="mt-3">
      {result.ok ? (result.message ?? "Done.") : result.error}
    </Notice>
  );
  return { pending, run, notice };
}

export function CompanyForm({ company, disabled }: { company: Company; disabled: boolean }) {
  const { pending, run, notice } = useResult();
  return (
    <form action={(fd) => run(() => saveCompanyProfile(fd))} className="grid gap-4 p-4 sm:grid-cols-2">
      <Field label="Company name" className="sm:col-span-2">
        <Input name="name" defaultValue={company.name} disabled={disabled} required />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Input name="address" defaultValue={company.address ?? ""} disabled={disabled} />
      </Field>
      <Field label="City">
        <Input name="city" defaultValue={company.city ?? ""} disabled={disabled} />
      </Field>
      <Field label="State">
        <Input name="state" defaultValue={company.state ?? ""} disabled={disabled} />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={company.phone ?? ""} disabled={disabled} />
      </Field>
      <div className="flex items-end">
        <Button variant="outline" disabled={pending || disabled}>
          Save
        </Button>
      </div>
      <div className="sm:col-span-2">{notice}</div>
    </form>
  );
}

export function TeamRow({ member, isMe, canEdit, roles }: { member: Member; isMe: boolean; canEdit: boolean; roles: Role[] }) {
  const { pending, run, notice } = useResult();
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          {member.email ?? "Teammate"} {isMe && <Badge>You</Badge>}
        </span>
        {canEdit && !isMe ? (
          <span className="flex items-center gap-1">
            <Select
              className="h-8 w-48 text-xs"
              defaultValue={member.role}
              disabled={pending}
              onChange={(e) => run(() => changeRole(member.userId, e.target.value as Role))}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </option>
              ))}
            </Select>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remove"
              disabled={pending}
              onClick={() => confirm(`Remove ${member.email}?`) && run(() => removeTeammate(member.userId))}
            >
              <Trash2 />
            </Button>
          </span>
        ) : (
          <span className="text-muted">{ROLE_LABEL[member.role] ?? member.role}</span>
        )}
      </div>
      {notice}
    </li>
  );
}

export function InviteForm({ roles }: { roles: Role[] }) {
  const { pending, run, notice } = useResult();
  return (
    <form action={(fd) => run(() => inviteTeammate(fd))} className="grid gap-3 border-t border-border p-4 sm:grid-cols-[1fr_auto_auto]">
      <Field label="Add a teammate">
        <Input name="email" type="email" placeholder="name@company.com" required />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue="project_manager">
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r] ?? r}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button disabled={pending}>Add</Button>
      </div>
      <div className="sm:col-span-3">{notice}</div>
    </form>
  );
}

export function SampleDataButton() {
  const { pending, run, notice } = useResult();
  return (
    <div>
      <Button variant="outline" disabled={pending} onClick={() => run(loadSampleData)}>
        {pending ? "Loading..." : "Load sample data"}
      </Button>
      {notice}
    </div>
  );
}
