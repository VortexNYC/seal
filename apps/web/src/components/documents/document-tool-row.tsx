import { Button } from "@cloudflare/kumo/components/button";
import { Popover } from "@cloudflare/kumo/components/popover";
import {
  ArrowClockwise,
  Calendar,
  CalendarCheck,
  CheckSquare,
  Envelope,
  PenNib,
  TextT,
  User,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import { rotateDocumentPdf } from "@/lib/api-client";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/field-types";
import { toast } from "@/lib/toast";

const FIELD_TOOLS: readonly { id: FieldType; icon: Icon }[] = [
  { id: "signature", icon: PenNib },
  { id: "initials", icon: TextT },
  { id: "name", icon: User },
  { id: "email", icon: Envelope },
  { id: "date", icon: Calendar },
  { id: "text", icon: TextT },
  { id: "checkbox", icon: CheckSquare },
  { id: "date_signed", icon: CalendarCheck },
];

export type DocumentToolRowProps = {
  organizationSlug: string;
  documentPublicId: string;
  pageCount: number;
  currentPage: number;
  armedField: FieldType | null;
  onArmField: (fieldType: FieldType) => void;
  onClearField: () => void;
  onPdfChanged: () => void;
  /** Increments when the rail asks the field menu to open. */
  openFieldsToken?: number;
};

export function DocumentToolRow({
  organizationSlug,
  documentPublicId,
  pageCount,
  currentPage,
  armedField,
  onArmField,
  onClearField,
  onPdfChanged,
  openFieldsToken = 0,
}: DocumentToolRowProps): JSX.Element {
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const armed = FIELD_TOOLS.find((tool) => tool.id === armedField);

  useEffect(() => {
    if (openFieldsToken < 1) return;
    setFieldsOpen(true);
  }, [openFieldsToken]);

  const rotate = useMutation({
    mutationFn: () =>
      rotateDocumentPdf(organizationSlug, documentPublicId, {
        degrees: 90,
        pages: [currentPage],
      }),
    onSuccess: () => {
      onPdfChanged();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not rotate");
    },
  });

  return (
    <>
      <span
        title="Choose a field, then click the page to place it"
        className="inline-flex"
      >
      <Popover
        open={fieldsOpen}
        onOpenChange={(open) => {
          setFieldsOpen(open);
        }}
      >
        <Popover.Trigger
          render={
            <Button
              type="button"
              size="sm"
              variant={armed ? "primary" : "ghost"}
              icon={armed?.icon ?? PenNib}
            >
              Fields
            </Button>
          }
        />
        <Popover.Content
          className="flex w-max flex-col gap-1 p-1.5"
          align="start"
        >
          {FIELD_TOOLS.map((tool) => (
            <span
              key={tool.id}
              title={`Place a ${FIELD_TYPE_LABELS[tool.id].toLowerCase()} field. Then click the page.`}
              className="inline-flex"
            >
            <Button
              type="button"
              size="sm"
              variant={armedField === tool.id ? "primary" : "ghost"}
              className="w-full justify-start"
              icon={tool.icon}
              onClick={() => {
                onArmField(tool.id);
                setFieldsOpen(false);
              }}
            >
              {FIELD_TYPE_LABELS[tool.id]}
            </Button>
            </span>
          ))}
          {armed ? (
            <span title="Stop placing a field" className="inline-flex">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  onClearField();
                  setFieldsOpen(false);
                }}
              >
                Stop placing
              </Button>
            </span>
          ) : null}
        </Popover.Content>
      </Popover>
      </span>
      <span
        title="Turn this page a quarter turn clockwise"
        className="inline-flex"
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Rotate page"
          loading={rotate.isPending}
          disabled={rotate.isPending || pageCount < 1}
          icon={ArrowClockwise}
          onClick={() => {
            rotate.mutate();
          }}
        >
          Rotate
        </Button>
      </span>
    </>
  );
}
