import type { ReactElement } from "react";
import { Button } from "@cloudflare/kumo/components/button";

import { cn } from "@/lib/utils";

import {
  DOCUMENT_CAPABILITIES,
  type DocumentCapabilityId,
} from "./document-workspace";

export type DocumentCapabilityRailProps = {
  active: DocumentCapabilityId;
  onChange: (id: DocumentCapabilityId) => void;
  className?: string;
};

/**
 * Persistent workspace switcher — capabilities under one roof, not exile modes.
 */
export function DocumentCapabilityRail({
  active,
  onChange,
  className,
}: DocumentCapabilityRailProps): ReactElement {
  const activeCapability = DOCUMENT_CAPABILITIES.find((c) => c.id === active);

  return (
    <div
      data-testid="document-capability-rail"
      className={cn("flex flex-col gap-2", className)}
    >
      <div
        role="tablist"
        aria-label="Document workspace"
        className="border-border bg-muted/30 flex flex-wrap gap-1 rounded-lg border p-1"
      >
        {DOCUMENT_CAPABILITIES.map((capability) => {
          const selected = capability.id === active;
          return (
            <Button
              key={capability.id}
              type="button"
              role="tab"
              aria-selected={selected}
              size="sm"
              variant={selected ? "primary" : "ghost"}
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                onChange(capability.id);
              }}
            >
              {capability.label}
            </Button>
          );
        })}
      </div>
      {activeCapability ? (
        <p className="text-muted-foreground px-0.5 text-[11px] leading-snug">
          {activeCapability.description}
        </p>
      ) : null}
    </div>
  );
}
