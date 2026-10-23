import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Plus, Trash } from "@phosphor-icons/react";
import type { JSX } from "react";
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
        index === 0 ? "Part 1" : index === 1 ? "Part 2" : `Part ${index + 1}`,
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
  const assigned = useMemo(
    () => new Set(splits.flatMap((s) => s.pages)),
    [splits]
  );
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
      <div className="border-kumo-line flex flex-col gap-1 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Split into drafts</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={addGroup}>
              <Plus className="size-3.5" />
              Add group
            </Button>
            {onApply ? (
              <Button
                type="button"
                size="sm"
                onClick={onApply}
                disabled={applying || splits.every((s) => s.pages.length === 0)}
              >
                {applying ? "Creating…" : "Create drafts"}
              </Button>
            ) : null}
          </div>
        </div>
        <Text as="p" variant="secondary" size="xs">Assign pages to named groups — each group becomes its own draft
          document.</Text>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {unassigned.length > 0 ? (
          <div className="border-kumo-line rounded-lg border border-dashed p-2">
            <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mb-2">Unassigned</Text>
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
            className="border-kumo-line bg-kumo-canvas space-y-2 rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label="Split group title"
                value={group.title}
                onChange={(e) => updateTitle(group.id, e.target.value)}
                className="h-8 flex-1 text-sm"
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
            <Text as="p" variant="secondary" size="xs" DANGEROUS_className="tabular-nums">{group.pages.length === 0
                ? "No pages"
                : `Pages ${group.pages[0]}–${group.pages[group.pages.length - 1]} · ${group.pages.length}`}</Text>
            <div className="flex flex-wrap gap-1">
              {group.pages.map((page) => (
                <Button
                  key={page}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelectPage?.(page)}
                >
                  {page}
                </Button>
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
    <div className="border-kumo-line bg-kumo-elevated inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
      <Button type="button" size="sm" variant="ghost" onClick={onSelect}>
        {page}
      </Button>
      <Select
        value=""
        onValueChange={(value) => {
          if (value) onAssign(value);
        }}
        placeholder="Assign"
        aria-label={`Assign page ${page}`}
      >
        {groups.map((group) => (
          <Select.Option key={group.id} value={group.id}>
            {group.title}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
}
