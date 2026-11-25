"use client";

import Link from "next/link";
import { useActionState } from "react";
import { brand } from "@/config/brand";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import type { FormState } from "./actions";

type Props = {
  title: string;
  subtitle: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  fields: { name: string; label: string; type?: string; autoComplete?: string; hint?: string }[];
  footer?: { text: string; href: string; link: string };
};

export function AuthForm({ title, subtitle, action, submitLabel, fields, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-lg font-bold text-black">
            {brand.name.slice(0, 1)}
          </span>
          <p className="mt-3 text-sm text-muted">{brand.tagline}</p>
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <form action={formAction} className="mt-5 space-y-4">
            {fields.map((f) => (
              <Field key={f.name} label={f.label} hint={f.hint}>
                <Input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
              </Field>
            ))}
            {state?.error && <Notice tone="danger">{state.error}</Notice>}
            {state?.message && <Notice tone="success">{state.message}</Notice>}
            <Button className="w-full" size="lg" disabled={pending}>
              {pending ? "One moment..." : submitLabel}
            </Button>
          </form>
        </Card>
        {footer && (
          <p className="mt-4 text-center text-sm text-muted">
            {footer.text}{" "}
            <Link href={footer.href} className="font-medium text-text underline">
              {footer.link}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
