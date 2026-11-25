"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui";
import { setJobArchived } from "../actions";

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!archived && !confirm("Archive this job? It will be hidden from lists and job matching. You can restore it later.")) return;
        start(() => setJobArchived(id, !archived));
      }}
    >
      {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
    </Button>
  );
}
