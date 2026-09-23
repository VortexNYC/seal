import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Plus, Trash } from "@phosphor-icons/react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type DocumentSplitGroup = {
  id: string;
  title: string;
  pages: number[];
};

function createId(): string {
  return `split-${crypto.randomUUID().slice(0, 8)}`;
}

export function createInitialSplits(pageCount: number): DocumentSplitGroup[] {
  if (pageCount <= 0) {
    return [{ id: createId(), title: "Document", pages: [1] }];
  }
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const chunk = Math.max(1, Math.ceil(pageCount / 3));
  return Array.from({ length: Math.ceil(pageCount / chunk) }, (_, index) => {
    const slice = pages.slice(index * chunk, index * chunk + chunk);
    return {
      id: createId(),
      title:
        index === 0
          ? "Part 1"
          : index === 1
            ? "Part 2"
            : `Part ${index + 1}`,
      pages: slice,
    };
  });
}

/**
 * Organize a long PDF into titled page groups (Extend Document Splits).
 * Controlled — parent owns apply/API.
 */
export function DocumentSplitsPanel({
  splits,
  pageCount,
  onChange,
  onSelectPage,
  onApply,
  applying = false,
  className,
}: {
  splits: DocumentSplitGroup[];
  pageCount: number;
  onChange: (splits: DocumentSplitGroup[]) => void;
  onSelectPage?: (page: number) => void;
  onApply?: () => void;
  applying?: boolean;
  className?: string;
}): JSX.Element {
  const assigned = useMemo(() => new Set(splits.flatMap((s) => s.pages)), [splits]);
  const unassigned = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, i) => i + 1).filter(
        (p) => !assigned.has(p)
      ),
    [assigned, pageCount]
  );

  function updateTitle(id: string, title: string): void {
    onChange(splits.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  function removeGroup(id: string): void {
    onChange(splits.filter((s) => s.id !== id));
  }

  function addGroup(): void {
    onChange([
      ...splits,
      { id: createId(), title: `Part ${splits.length + 1}`, pages: [] },
    ]);
  }

  function movePageToGroup(page: number, groupId: string): void {
    onChange(
      splits.map((s) => {
        const without = s.pages.filter((p) => p !== page);
        if (s.id !== groupId) return { ...s, pages: without };
        return {
          ...s,
          pages: [...without, page].sort((a, b) => a - b),
        };
      })
    );
  }

  return (
    <div
      data-kumo-docs="document-splits"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Splits</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={addGroup}>
            <Plus className="size-3.5" />
            Add
          </Button>
          {onApply ? (
            <Button
              type="button"
              size="sm"
              onClick={onApply}
              disabled={applying || splits.every((s) => s.pages.length === 0)}
            >
              {applying ? "Splitting…" : "Apply"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {unassigned.length > 0 ? (
          <div className="border-border rounded-lg border border-dashed p-2">
            <p className="text-muted-foreground mb-2 text-[11px] uppercase tracking-wide">
              Unassigned
            </p>
            <div className="flex flex-wrap gap-1">
              {unassigned.map((page) => (
                <PageChip
                  key={page}
                  page={page}
                  onSelect={() => onSelectPage?.(page)}
                  groups={splits}
                  onAssign={(groupId) => movePageToGroup(page, groupId)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {splits.map((group) => (
          <div
            key={group.id}
            className="border-border bg-background space-y-2 rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={group.title}
                onChange={(e) => updateTitle(group.id, e.target.value)}
                className="h-8 flex-1 text-sm"
                aria-label="Split title"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeGroup(group.id)}
                aria-label={`Remove ${group.title}`}
              >
                <Trash className="size-3.5" />
              </Button>
            </div>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              {group.pages.length === 0
                ? "No pages"
                : `Pages ${group.pages[0]}–${group.pages[group.pages.length - 1]} · ${group.pages.length}`}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.pages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => onSelectPage?.(page)}
                  className="border-border bg-muted hover:border-ring rounded-md border px-2 py-1 text-xs tabular-nums"
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageChip({
  page,
  onSelect,
  groups,
  onAssign,
}: {
  page: number;
  onSelect: () => void;
  groups: DocumentSplitGroup[];
  onAssign: (groupId: string) => void;
}): JSX.Element {
  return (
    <div className="border-border bg-muted inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
      <button
        type="button"
        onClick={onSelect}
        className="text-xs tabular-nums"
      >
        {page}
      </button>
      <select
        className="bg-transparent text-[10px] outline-none"
        defaultValue=""
        aria-label={`Assign page ${page}`}
        onChange={(e) => {
          if (e.target.value) onAssign(e.target.value);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          →
        </option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </select>
    </div>
  );
}
