"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Notice } from "@/components/ui";
import { cn } from "@/lib/utils";

type Result = { name: string; id?: string; error?: string };

export function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setResults([]);
    setBusy(`Reading ${list.length} invoice${list.length > 1 ? "s" : ""}... this can take up to a minute each.`);
    const all: Result[] = [];
    // Send in small batches so one slow file doesn't hold up the rest.
    for (let i = 0; i < list.length; i += 3) {
      const form = new FormData();
      list.slice(i, i + 3).forEach((f) => form.append("files", f));
      try {
        const res = await fetch("/api/invoices/upload", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) all.push(...list.slice(i, i + 3).map((f) => ({ name: f.name, error: body.error ?? "Upload failed" })));
        else all.push(...body.results);
      } catch {
        all.push(...list.slice(i, i + 3).map((f) => ({ name: f.name, error: "Upload failed. Check your connection." })));
      }
      setResults([...all]);
      router.refresh();
    }
    setBusy(null);
    if (input.current) input.current.value = "";
  }

  const failed = results.filter((r) => r.error);
  const done = results.filter((r) => r.id);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) upload(e.dataTransfer.files);
        }}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-8 text-center transition-colors hover:border-accent",
          dragging && "border-accent bg-accent/10",
          busy && "cursor-wait opacity-80",
        )}
      >
        {busy ? <Loader2 className="size-7 animate-spin text-muted" /> : <Upload className="size-7 text-muted" />}
        <p className="font-medium">{busy ?? "Drop invoices here, or tap to choose files"}</p>
        {!busy && <p className="text-sm text-muted">PDF or photos. Several at once is fine. On a phone you can take a picture.</p>}
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>
      {done.length > 0 && !busy && (
        <Notice tone="success" className="mt-3">
          {done.length} invoice{done.length > 1 ? "s" : ""} added. Check each one below and press Confirm.
        </Notice>
      )}
      {failed.length > 0 && (
        <Notice tone="danger" title="Some files weren't added" className="mt-3">
          <ul className="list-disc pl-5">
            {failed.map((f) => (
              <li key={f.name}>
                {f.name}: {f.error}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}
