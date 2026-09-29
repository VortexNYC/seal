import { CheckCircle, Circle } from "@phosphor-icons/react";
import type { JSX } from "react";

import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/field-types";
import { cn } from "@/lib/utils";

export type SignerFormField = {
  id: string;
  label: string;
  fieldType: string;
  page: number;
  isRequired: boolean;
  isFilled: boolean;
};

export type SignerFormViewProps = {
  fields: SignerFormField[];
  activeFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  disabled?: boolean;
};

function typeLabel(fieldType: string): string {
  if (fieldType in FIELD_TYPE_LABELS) {
    return FIELD_TYPE_LABELS[fieldType as FieldType];
  }
  return fieldType;
}

/**
 * SEA-86 — Dropbox-class Form View for phone signers.
 * List every placed field; tap opens the input. No pinch-zoom required.
 */
export function SignerFormView({
  fields,
  activeFieldId,
  onSelectField,
  disabled = false,
}: SignerFormViewProps): JSX.Element {
  if (fields.length === 0) {
    return (
      <div
        className="border-kumo-hairline/50 bg-kumo-elevated rounded-xl border p-6 text-center"
        data-testid="signer-form-view-empty"
      >
        <p className="text-kumo-secondary text-sm">
          No fields to complete on this document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="signer-form-view">
      <p className="text-kumo-secondary text-sm">
        Tap a field to fill it. You can switch to the document anytime.
      </p>
      <ul className="divide-border border-border bg-background divide-y overflow-hidden rounded-xl border">
        {fields.map((field, index) => {
          const isActive = activeFieldId === field.id;
          const title =
            field.label.trim().length > 0
              ? field.label
              : typeLabel(field.fieldType);
          return (
            <li key={field.id}>
              <button
                type="button"
                data-testid={`signer-form-field-${field.id}`}
                disabled={disabled}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  onSelectField(field.id);
                }}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                  "hover:bg-kumo-elevated focus-visible:bg-kumo-elevated focus-visible:outline-none",
                  isActive && "bg-kumo-elevated",
                  disabled && "opacity-60"
                )}
              >
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {field.isFilled ? (
                    <CheckCircle
                      className="text-kumo-success h-5 w-5"
                      weight="fill"
                    />
                  ) : (
                    <Circle className="text-kumo-secondary h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-kumo-primary flex items-center gap-2 text-sm font-medium">
                    <span className="text-kumo-secondary tabular-nums">
                      {index + 1}.
                    </span>
                    <span className="truncate">{title}</span>
                    {field.isRequired && !field.isFilled ? (
                      <span className="text-kumo-danger text-xs font-normal">
                        Required
                      </span>
                    ) : null}
                  </span>
                  <span className="text-kumo-secondary mt-0.5 block text-xs">
                    {typeLabel(field.fieldType)} · Page {field.page}
                    {field.isFilled ? " · Done" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
