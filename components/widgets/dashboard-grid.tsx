"use client";

import { useEffect, useState, useTransition } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import { EyeOff, LayoutGrid, Plus, RotateCcw, Save, X } from "lucide-react";
import type { WidgetPlacement } from "@/config/dashboard";
import { Button, Card, Notice } from "@/components/ui";
import { cn } from "@/lib/utils";
import { widgetRegistry } from "./registry";
import type { DashboardData } from "./types";

const Grid = WidthProvider(Responsive);
const ROW_HEIGHT = 64;

export function DashboardGrid({
  data,
  layout: initial,
  isCustom,
  onSave,
}: {
  data: DashboardData;
  layout: WidgetPlacement[];
  isCustom: boolean;
  onSave: (layout: WidgetPlacement[] | null) => Promise<void>;
}) {
  const [layout, setLayout] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, start] = useTransition();
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => setLayout(initial), [initial]);

  const known = layout.filter((p) => widgetRegistry[p.widget]);

  const onLayoutChange = (rgl: Layout[]) => {
    if (!editing) return;
    setLayout((prev) =>
      prev.map((p) => {
        const l = rgl.find((x) => x.i === p.id);
        return l ? { ...p, x: l.x, y: l.y, w: l.w, h: l.h } : p;
      }),
    );
  };

  const addWidget = (widget: string, title: string, props?: Record<string, unknown>) => {
    const def = widgetRegistry[widget];
    const bottom = layout.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    setLayout((prev) => [
      ...prev,
      { id: `${widget}-${Date.now()}`, widget, title, x: 0, y: bottom, w: def.size.w, h: def.size.h, props },
    ]);
    setShowLibrary(false);
  };

  const card = (p: WidgetPlacement) => {
    const W = widgetRegistry[p.widget].component;
    return (
      <Card className={cn("flex h-full flex-col overflow-hidden", editing && "ring-2 ring-accent/40")}>
        {/* Number cards show their own title, so they only get a header bar while editing */}
        {(editing || p.widget !== "KpiCard") && (
        <div className={cn("flex items-center justify-between gap-2 border-b border-border px-4 py-2", editing && "drag-handle cursor-move bg-surface-2")}>
          <h2 className="truncate text-sm font-semibold">{p.title}</h2>
          {editing && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setLayout((prev) => prev.filter((x) => x.id !== p.id))}
              className="rounded p-1 text-muted hover:bg-surface hover:text-danger"
              aria-label={`Hide ${p.title}`}
            >
              <EyeOff className="size-4" />
            </button>
          )}
        </div>
        )}
        <div className="min-h-0 flex-1">
          <W data={data} title={p.title} props={p.props} />
        </div>
      </Card>
    );
  };

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      {editing ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setShowLibrary((s) => !s)}>
            <Plus /> Add widget
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              confirm("Go back to the standard layout? Your changes will be lost.") &&
              start(async () => {
                await onSave(null);
                setEditing(false);
              })
            }
          >
            <RotateCcw /> Reset to default
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setLayout(initial); setEditing(false); setShowLibrary(false); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              start(async () => {
                await onSave(layout);
                setEditing(false);
                setShowLibrary(false);
              })
            }
          >
            <Save /> Save layout
          </Button>
        </>
      ) : (
        !isPhone && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <LayoutGrid /> Edit layout {isCustom && <span className="text-xs text-muted">(custom)</span>}
          </Button>
        )
      )}
    </div>
  );

  // Phones: one column, in layout order. Editing is done on a bigger screen.
  if (isPhone) {
    const ordered = [...known].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div className="space-y-4">
        {ordered.map((p) => (
          <div key={p.id} style={{ height: Math.max(p.h, p.widget === "KpiCard" ? 2 : 4) * ROW_HEIGHT }}>
            {card(p)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      {editing && (
        <Notice tone="neutral" className="mb-4">
          Drag a widget by its title bar. Drag the bottom-right corner to resize. Press the eye icon to hide one. Press Save when done.
        </Notice>
      )}
      {editing && showLibrary && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Widget library</p>
            <button onClick={() => setShowLibrary(false)} aria-label="Close" className="text-muted hover:text-text">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(widgetRegistry).flatMap(([widget, def]) =>
              def.library.map((item) => {
                const onBoard = layout.some(
                  (p) => p.widget === widget && JSON.stringify(p.props ?? {}) === JSON.stringify(item.props ?? {}),
                );
                return (
                  <button
                    key={`${widget}-${item.title}`}
                    onClick={() => addWidget(widget, item.title, item.props)}
                    className="rounded-lg border border-border p-3 text-left hover:border-accent hover:bg-surface-2"
                  >
                    <p className="text-sm font-medium">
                      {item.title} {onBoard && <span className="text-xs font-normal text-muted">(on dashboard)</span>}
                    </p>
                    <p className="text-xs text-muted">{item.description}</p>
                  </button>
                );
              }),
            )}
          </div>
        </Card>
      )}
      <Grid
        className="-mx-2.5"
        layouts={{
          lg: known.map((p) => {
            const s = widgetRegistry[p.widget].size;
            return { i: p.id, x: p.x, y: p.y, w: p.w, h: p.h, minW: s.minW, minH: s.minH };
          }),
        }}
        breakpoints={{ lg: 768 }}
        cols={{ lg: 12 }}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".drag-handle"
        onLayoutChange={onLayoutChange}
        compactType="vertical"
      >
        {known.map((p) => (
          <div key={p.id}>{card(p)}</div>
        ))}
      </Grid>
    </div>
  );
}
