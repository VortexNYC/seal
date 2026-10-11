import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { OversightFrame } from "@/components/oversight-frame";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { getDocumentSharing } from "@/lib/api-client";
import {
  signerProgressLine,
  type DocumentWorkflowStatus,
  type SigningProgress,
} from "@/lib/document-status";

export function DocumentOversightRail({
  organizationSlug,
  documentId,
  name,
  workflowStatus,
  progress,
  onClose,
}: {
  readonly organizationSlug: string;
  readonly documentId: string;
  readonly name: string;
  readonly workflowStatus: DocumentWorkflowStatus | undefined;
  readonly progress: SigningProgress | null | undefined;
  readonly onClose: () => void;
}): ReactElement {
  const sharing = useQuery({
    queryKey: ["api", "documents", "sharing", organizationSlug, documentId],
    queryFn: () => getDocumentSharing(organizationSlug, documentId),
  });
  const navigate = useNavigate();
  const waiting = signerProgressLine(workflowStatus, progress);

  return (
    <OversightFrame title="Details" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Text as="p" bold>
            {name}
          </Text>
          <WorkflowStatusBadge status={workflowStatus} />
          {waiting ? (
            <Text as="p" variant="secondary" size="sm">
              {waiting}
            </Text>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Text as="p" variant="secondary" size="xs">
            Owner
          </Text>
          <Text as="p" size="sm">
            {sharing.data
              ? (sharing.data.owner.name ?? sharing.data.owner.email)
              : "Loading"}
          </Text>
          {sharing.data?.owner.name ? (
            <Text as="p" variant="secondary" size="xs">
              {sharing.data.owner.email}
            </Text>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Text as="p" variant="secondary" size="xs">
            Shared with
          </Text>
          {sharing.data && sharing.data.sharedWith.length === 0 ? (
            <Text as="p" size="sm">
              Only the owner
            </Text>
          ) : null}
          {sharing.data?.sharedWith.map((person) => (
            <Text as="p" size="sm" key={person.id}>
              {person.userName ?? person.userEmail}
            </Text>
          ))}
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            void navigate({
              to: "/$slug/documents/$documentId",
              params: { slug: organizationSlug, documentId },
            });
          }}
        >
          Open document
        </Button>
      </div>
    </OversightFrame>
  );
}
