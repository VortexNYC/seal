import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { OversightFrame } from "@/components/oversight-frame";
import { getContactRelatedDocuments, type ApiContact } from "@/lib/api-client";
import { toWorkflowStatus } from "@/lib/document-status";

export function ContactOversightPanel({
  organizationSlug,
  contact,
  onClose,
}: {
  readonly organizationSlug: string;
  readonly contact: ApiContact;
  readonly onClose: () => void;
}): ReactElement {
  const navigate = useNavigate();
  const related = useQuery({
    queryKey: [
      "api",
      "contacts",
      "related-documents",
      contact.email,
      organizationSlug,
    ],
    queryFn: () => getContactRelatedDocuments(organizationSlug, contact.email),
  });

  return (
    <OversightFrame title="Contact" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Text as="p" bold>
            {contact.fullName}
          </Text>
          <Text as="p" variant="secondary" size="sm">
            {contact.email}
          </Text>
          {contact.company ? (
            <Text as="p" size="sm">
              {contact.company}
            </Text>
          ) : null}
          {contact.title ? (
            <Text as="p" variant="secondary" size="xs">
              {contact.title}
            </Text>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Text as="p" variant="secondary" size="xs">
            Envelopes
          </Text>
          {related.data && related.data.length === 0 ? (
            <Text as="p" size="sm">
              No envelopes yet
            </Text>
          ) : null}
          {related.data?.map((document) => (
            <Link
              key={document.id}
              to="/$slug/documents/$documentId"
              params={{ slug: organizationSlug, documentId: document.id }}
              className="flex items-center justify-between gap-2"
            >
              <Text as="span" size="sm" truncate>
                {document.name}
              </Text>
              <WorkflowStatusBadge
                status={toWorkflowStatus(document.workflowStatus)}
              />
            </Link>
          ))}
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            void navigate({
              to: "/$slug/contacts/$contactId",
              params: { slug: organizationSlug, contactId: contact._id },
            });
          }}
        >
          Open contact
        </Button>
      </div>
    </OversightFrame>
  );
}
