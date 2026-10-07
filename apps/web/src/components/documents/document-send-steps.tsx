/**
 * Draft send path — three steps, one current. Click jumps to the right section.
 */

import { Tabs } from "@cloudflare/kumo/components/tabs";
import type { ReactElement } from "react";

export type SendStepId = 1 | 2 | 3;

interface DocumentSendStepsProps {
  current: SendStepId;
  onSelect: (step: SendStepId) => void;
}

const STEPS: ReadonlyArray<{ id: SendStepId; label: string; tip: string }> = [
  { id: 1, label: "People", tip: "Add who needs to sign, approve, or view" },
  { id: 2, label: "Fields", tip: "Place the fields they fill in" },
  { id: 3, label: "Send", tip: "Send the document" },
];

function isSendStep(value: string): value is `${SendStepId}` {
  return value === "1" || value === "2" || value === "3";
}

export function DocumentSendSteps({
  current,
  onSelect,
}: DocumentSendStepsProps): ReactElement {
  return (
    <nav aria-label="Send document steps" data-testid="document-send-steps">
      <Tabs
        variant="segmented"
        size="sm"
        value={String(current)}
        onValueChange={(value) => {
          if (isSendStep(value)) onSelect(Number(value) as SendStepId);
        }}
        tabs={STEPS.map((step) => ({
          value: String(step.id),
          label: step.label,
          render: (props) => (
            <button
              type="button"
              {...props}
              title={step.tip}
              onClick={(event) => {
                props.onClick?.(event);
                onSelect(step.id);
              }}
            />
          ),
        }))}
      />
    </nav>
  );
}

export function resolveSendStep(input: {
  recipientCount: number;
  fieldCount: number;
  canSend: boolean;
}): SendStepId {
  if (input.recipientCount === 0) return 1;
  if (input.fieldCount === 0 || !input.canSend) return 2;
  return 3;
}
