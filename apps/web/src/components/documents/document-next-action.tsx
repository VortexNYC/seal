/**
 * Single “what do I do next?” card for document detail.
 * Replaces ceremony status hero with a clear step + one primary action.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  CheckCircle,
  DownloadSimple,
  PaperPlaneTilt,
  Signature,
  UserPlus,
} from "@phosphor-icons/react";
import { type ReactElement, useState } from "react";

import { formatDate, getStatusLabel } from "@/lib/formatting";
import { cn } from "@/lib/utils";

import type { DocumentWorkflowStatus } from "./workflow-status-badge";

export type DocumentNextActionModel =
  | {
      kind: "add_people";
      onAction: () => void;
    }
  | {
      kind: "place_fields";
      onAction: () => void;
    }
  | {
      kind: "fix_fields";
      detail: string;
      onAction: () => void;
    }
  | {
      kind: "send";
      label: string;
      onAction: () => void;
    }
  | {
      kind: "sign_yourself";
      onAction: () => void;
    }
  | {
      kind: "waiting";
      detail: string;
    }
  | {
      kind: "done";
      onDownload: () => void;
    }
  | {
      kind: "status";
      detail?: string;
    };

interface DocumentNextActionProps {
  workflowStatus: DocumentWorkflowStatus | undefined;
  createdAt: number;
  model: DocumentNextActionModel;
  onVoid?: () => void;
  className?: string;
}

function copyFor(
  model: DocumentNextActionModel,
  statusLabel: string
): { title: string; body: string } {
  switch (model.kind) {
    case "add_people":
      return {
        title: "Add people",
        body: "Who needs to sign or approve? Add them, then place fields.",
      };
    case "place_fields":
      return {
        title: "Place signature fields",
        body: "Drag fields onto the PDF for each signer, then send.",
      };
    case "fix_fields":
      return {
        title: "Finish setup",
        body: model.detail,
      };
    case "send":
      return {
        title: "Ready to send",
        body: "Recipients get an email with their signing link.",
      };
    case "sign_yourself":
      return {
        title: "Your turn",
        body: "You're on this document — complete your fields.",
      };
    case "waiting":
      return {
        title: statusLabel,
        body: model.detail,
      };
    case "done":
      return {
        title: "Complete",
        body: "Everyone’s finished.",
      };
    case "status":
      return {
        title: statusLabel,
        body: model.detail ?? "Track progress in Recipients and Activity.",
      };
  }
}

export function DocumentNextAction({
  workflowStatus,
  createdAt,
  model,
  onVoid,
  className,
}: DocumentNextActionProps): ReactElement {
  const [confirmVoid, setConfirmVoid] = useState(false);
  const statusLabel = getStatusLabel(workflowStatus);
  const { title, body } = copyFor(model, statusLabel);

  return (
    <LayerCard
      data-seal-enter
      data-testid="document-next-action"
      className={cn("flex flex-col gap-3 p-4", className)}
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <Text variant="secondary" size="sm">
          {statusLabel}
          {" · "}Created {formatDate(createdAt)}
        </Text>
        <Text as="h2" variant="heading">
          {title}
        </Text>
        <Text variant="secondary" size="sm">
          {body}
        </Text>
      </div>

      {model.kind === "add_people" ? (
        <span title="Add who needs to sign" className="inline-flex w-full">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={UserPlus}
          onClick={model.onAction}
        >
          Add people
        </Button>
        </span>
      ) : null}

      {model.kind === "place_fields" || model.kind === "fix_fields" ? (
        <span
          title={
            model.kind === "place_fields"
              ? "Place the fields on the page"
              : "Review the fields that still need attention"
          }
          className="inline-flex w-full"
        >
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={Signature}
          onClick={model.onAction}
        >
          {model.kind === "place_fields" ? "Show fields" : "Review fields"}
        </Button>
        </span>
      ) : null}

      {model.kind === "send" ? (
        <span title="Send this document" className="inline-flex w-full">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={PaperPlaneTilt}
          onClick={model.onAction}
        >
          {model.label}
        </Button>
        </span>
      ) : null}

      {model.kind === "sign_yourself" ? (
        <span title="Continue signing this document" className="inline-flex w-full">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={Signature}
          onClick={model.onAction}
        >
          Continue signing
        </Button>
        </span>
      ) : null}

      {onVoid && model.kind !== "done" && model.kind !== "send" ? (
        <Button
          type="button"
          variant={confirmVoid ? "destructive" : "outline"}
          className="w-full"
          onClick={() => {
            if (!confirmVoid) {
              setConfirmVoid(true);
              return;
            }
            onVoid();
          }}
        >
          {confirmVoid ? "Void this document" : "Void"}
        </Button>
      ) : null}

      {model.kind === "done" ? (
        <>
          <Button
            type="button"
            variant="primary"
            className="w-full"
            icon={DownloadSimple}
            onClick={model.onDownload}
          >
            Download PDF
          </Button>
          <Text variant="secondary" size="sm" DANGEROUS_className="flex items-center gap-2">
            <CheckCircle className="size-5" />
            Nothing needed from you
          </Text>
        </>
      ) : null}
    </LayerCard>
  );
}
