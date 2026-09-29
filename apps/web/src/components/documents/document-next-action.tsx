/**
 * Single “what do I do next?” card for document detail.
 * Replaces ceremony status hero with a clear step + one primary action.
 */

import { Button } from "@cloudflare/kumo/components/button";
import {
  CheckCircle,
  PaperPlaneTilt,
  Signature,
  UserPlus,
} from "@phosphor-icons/react";
import type { ReactElement } from "react";

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
    }
  | {
      kind: "status";
      detail?: string;
    };

interface DocumentNextActionProps {
  workflowStatus: DocumentWorkflowStatus | undefined;
  createdAt: number;
  model: DocumentNextActionModel;
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
        body: "Everyone’s finished. Download the signed PDF anytime.",
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
  className,
}: DocumentNextActionProps): ReactElement {
  const statusLabel = getStatusLabel(workflowStatus);
  const { title, body } = copyFor(model, statusLabel);

  const surface =
    model.kind === "done"
      ? "bg-status-completed-surface border-status-completed-border"
      : model.kind === "send" || model.kind === "sign_yourself"
        ? "bg-status-sent-surface border-status-sent-border"
        : "bg-card border-border";

  return (
    <div
      data-seal-enter
      data-testid="document-next-action"
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-4 shadow-sm",
        surface,
        className
      )}
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground m-0 text-sm">
          {statusLabel}
          {" · "}Created {formatDate(createdAt)}
        </p>
        <h2 className="text-foreground m-0 text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground m-0 text-sm text-pretty">{body}</p>
      </div>

      {model.kind === "add_people" ? (
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={<UserPlus className="size-4" />}
          onClick={model.onAction}
        >
          Add people
        </Button>
      ) : null}

      {model.kind === "place_fields" || model.kind === "fix_fields" ? (
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={<Signature className="size-4" />}
          onClick={model.onAction}
        >
          {model.kind === "place_fields" ? "Show fields" : "Review fields"}
        </Button>
      ) : null}

      {model.kind === "send" ? (
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={<PaperPlaneTilt className="size-4" />}
          onClick={model.onAction}
        >
          {model.label}
        </Button>
      ) : null}

      {model.kind === "sign_yourself" ? (
        <Button
          type="button"
          variant="primary"
          className="w-full"
          icon={<Signature className="size-4" />}
          onClick={model.onAction}
        >
          Continue signing
        </Button>
      ) : null}

      {model.kind === "done" ? (
        <div className="text-status-completed-text flex items-center gap-2 text-sm font-medium">
          <CheckCircle className="size-5" weight="fill" />
          Nothing needed from you
        </div>
      ) : null}
    </div>
  );
}
