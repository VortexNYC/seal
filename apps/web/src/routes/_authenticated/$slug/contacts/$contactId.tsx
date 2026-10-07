/**
 * Contact Detail Page
 *
 * Displays full contact information with edit/delete actions,
 * and a list of related documents found via document_recipients.
 * Route: /{slug}/contacts/{contactId}
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  Envelope,
  PencilSimple,
  Phone,
  Trash,
  User,
} from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Suspense, useState, type ReactElement } from "react";

import { ContactStatusBadge } from "@/components/contacts/contact-status-badge";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { PageWrapper } from "@/components/page-wrapper";
import {
  deleteContact,
  getContact,
  getContactRelatedDocuments,
  type ApiRelatedDocument,
} from "@/lib/api-client";
import { toWorkflowStatus } from "@/lib/document-status";
import { formatDate } from "@/lib/formatting";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/contacts/$contactId"
)({
  component: ContactDetailPage,
  pendingComponent: ContactDetailSkeleton,
});

function ContactDetailSkeleton(): ReactElement {
  return (
    <PageWrapper title="Contact">
      <div className="flex w-full flex-col gap-4">
        <SkeletonLine className="h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonLine className="h-64 w-full rounded-xl lg:col-span-2" />
          <SkeletonLine className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </PageWrapper>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | undefined | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-kumo-secondary mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <Text as="p" variant="secondary" size="xs">
          {label}
        </Text>
        <Text as="p" size="sm">
          {value}
        </Text>
      </div>
    </div>
  );
}

function RelatedDocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <SkeletonLine className="h-4 w-40" />
          <SkeletonLine className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function RelatedDocumentsContent({
  email,
  slug,
}: {
  email: string;
  slug: string;
}) {
  const router = useRouter();
  const { data: documents } = useSuspenseQuery({
    queryKey: ["api", "contacts", "related-documents", email, slug],
    queryFn: () => getContactRelatedDocuments(slug, email),
  });

  if ((documents ?? []).length === 0) {
    return (
      <Text as="p" variant="secondary" size="sm" DANGEROUS_className="py-4">No documents found</Text>
    );
  }

  return (
    <div className="space-y-3">
      {(documents ?? []).map((doc: ApiRelatedDocument) => (
        <Button
          key={doc.id}
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between"
          onClick={() =>
            router.navigate({
              to: "/$slug/documents/$documentId",
              params: { slug, documentId: doc.id },
            })
          }
        >
          <div className="min-w-0 flex-1">
            <Text as="p" size="sm" bold truncate>{doc.name}</Text>
            <span className="capitalize">
              <Text as="p" variant="secondary" size="xs">
                {doc.role}
              </Text>
            </span>
          </div>
          <WorkflowStatusBadge status={toWorkflowStatus(doc.workflowStatus)} />
        </Button>
      ))}
    </div>
  );
}

function ContactDetailContent() {
  const params = Route.useParams();
  const slug = params.slug;
  const contactId = params.contactId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: contact } = useSuspenseQuery({
    queryKey: ["api", "contacts", contactId, slug],
    queryFn: () => getContact(slug, contactId),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteContact(slug, contactId);
      await queryClient.invalidateQueries({ queryKey: ["api", "contacts"] });
      toast.success("Contact deleted");
      void router.navigate({ to: "/$slug/contacts", params: { slug } });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete contact";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <PageWrapper title={contact.fullName}>
      <div className="flex w-full flex-col gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-kumo-secondary hover:text-kumo-default gap-1"
            onClick={() =>
              router.navigate({ to: "/$slug/contacts", params: { slug } })
            }
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Contacts
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column: Contact info */}
          <div className="lg:col-span-2">
            <LayerCard>
              <LayerCard.Secondary className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Text as="h2" variant="heading">
                    {contact.fullName}
                  </Text>
                  <ContactStatusBadge status={contact.status} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                 icon={PencilSimple}>
                  Edit
                </Button>
              </LayerCard.Secondary>

              <LayerCard.Primary>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoRow
                    icon={Envelope}
                    label="Email"
                    value={contact.email}
                  />
                  <InfoRow icon={Phone} label="Phone" value={contact.phone} />
                  <InfoRow
                    icon={Building}
                    label="Company"
                    value={contact.company}
                  />
                  <InfoRow icon={User} label="Title" value={contact.title} />
                </div>

                {contact.notes && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-start gap-3">
                      <PencilSimple className="text-kumo-secondary mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <Text as="p" variant="secondary" size="xs">
                          Notes
                        </Text>
                        <Text as="p" size="sm" DANGEROUS_className="whitespace-pre-wrap">{contact.notes}</Text>
                      </div>
                    </div>
                  </div>
                )}

                {contact.tags && contact.tags.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <div className="mb-2">
                      <Text as="p" variant="secondary" size="xs">
                        Tags
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 border-t pt-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="text-kumo-secondary mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <Text as="p" variant="secondary" size="xs">
                          Created
                        </Text>
                        <Text as="p" size="sm">
                          {formatDate(contact.createdAt)}
                        </Text>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="text-kumo-secondary mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <Text as="p" variant="secondary" size="xs">
                          Updated
                        </Text>
                        <Text as="p" size="sm">
                          {formatDate(contact.updatedAt)}
                        </Text>
                      </div>
                    </div>
                    {contact.lastContactedAt && (
                      <div className="flex items-start gap-3">
                        <Calendar className="text-kumo-secondary mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <Text as="p" variant="secondary" size="xs">
                            Last Contacted
                          </Text>
                          <Text as="p" size="sm">
                            {formatDate(contact.lastContactedAt)}
                          </Text>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <div className="mt-6 border-t pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                   icon={Trash}>
                    Delete Contact
                  </Button>
                </div>
              </LayerCard.Primary>
            </LayerCard>
          </div>

          {/* Right column: Related documents */}
          <div className="lg:col-span-1">
            <LayerCard>
              <LayerCard.Secondary>
                <Text as="h3" size="sm" DANGEROUS_className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Related Documents
                </Text>
              </LayerCard.Secondary>
              <LayerCard.Primary>
                <Suspense fallback={<RelatedDocumentsSkeleton />}>
                  <RelatedDocumentsContent email={contact.email} slug={slug} />
                </Suspense>
              </LayerCard.Primary>
            </LayerCard>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <EditContactDialog
        organizationSlug={slug}
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        onUpdated={() =>
          queryClient.invalidateQueries({ queryKey: ["api", "contacts"] })
        }
      />

      {/* Delete confirmation */}
      <Dialog.Root
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role="alertdialog"
      >
        <Dialog size="sm" className="p-6">
          <div className="space-y-1.5">
            <Dialog.Title>Delete Contact</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to delete &ldquo;{contact.fullName}&rdquo;?
              This action cannot be undone.
            </Dialog.Description>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </PageWrapper>
  );
}

function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper title="Loading...">
          <div className="mb-6">
            <SkeletonLine className="h-4 w-32" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LayerCard>
                <LayerCard.Secondary>
                  <SkeletonLine className="h-6 w-48" />
                </LayerCard.Secondary>
                <LayerCard.Primary className="space-y-4">
                  <SkeletonLine className="h-4 w-64" />
                  <SkeletonLine className="h-4 w-48" />
                  <SkeletonLine className="h-4 w-56" />
                </LayerCard.Primary>
              </LayerCard>
            </div>
            <div className="lg:col-span-1">
              <LayerCard>
                <LayerCard.Secondary>
                  <SkeletonLine className="h-5 w-40" />
                </LayerCard.Secondary>
                <LayerCard.Primary>
                  <RelatedDocumentsSkeleton />
                </LayerCard.Primary>
              </LayerCard>
            </div>
          </div>
        </PageWrapper>
      }
    >
      <ContactDetailContent />
    </Suspense>
  );
}
