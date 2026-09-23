import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Plus, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type BindingRow = {
  fieldId: string;
  fieldLabel: string;
  bindingKey: string;
};

/**
 * Map signature fields ↔ structured keys (Extend Schema Builder, Seal-shaped).
 * Uses `properties.binding_key` — not a generic JSON schema editor.
 */
export function BindingsPanel({
  rows,
  onChange,
  onSave,
  saving = false,
  className,
}: {
  rows: BindingRow[];
  onChange: (rows: BindingRow[]) => void;
  onSave?: () => void;
  saving?: boolean;
  className?: string;
}): JSX.Element {
  function setKey(fieldId: string, bindingKey: string): void {
    onChange(
      rows.map((row) => (row.fieldId === fieldId ? { ...row, bindingKey } : row))
    );
  }

  function clearKey(fieldId: string): void {
    setKey(fieldId, "");
  }

  return (
    <div
      data-kumo-docs="bindings-panel"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Bindings</span>
        {onSave ? (
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Place fields first, then bind them to structured keys.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.fieldId} className="space-y-1.5">
              <Label className="text-xs">{row.fieldLabel}</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={row.bindingKey}
                  onChange={(e) => setKey(row.fieldId, e.target.value)}
                  placeholder="binding_key"
                  className="font-mono text-xs"
                  spellCheck={false}
                />
                {row.bindingKey ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearKey(row.fieldId)}
                    aria-label={`Clear binding for ${row.fieldLabel}`}
                  >
                    <Trash className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled
                    aria-hidden
                  >
                    <Plus className="size-3.5 opacity-0" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
