/**
 * Contact Detail Page
 *
 * Displays full contact information with edit/delete actions,
 * and a list of related documents found via document_recipients.
 * Route: /{slug}/contacts/{contactId}
 */

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  FileTextIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  StickyNoteIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { ContactStatusBadge } from "@/components/contacts/contact-status-badge";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { PageWrapper } from "@/components/page-wrapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteContact,
  getContact,
  getContactRelatedDocuments,
  type ApiRelatedDocument,
} from "@/lib/api-client";
import { toWorkflowStatus } from "@/lib/document-status";
import { formatDate } from "@/lib/formatting";

export const Route = createFileRoute(
  "/_authenticated/$slug/contacts/$contactId"
)({
  component: ContactDetailPage,
});

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
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function RelatedDocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
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
      <p className="text-muted-foreground py-4 text-center text-sm">
        No documents found
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {(documents ?? []).map((doc: ApiRelatedDocument) => (
        <button
          key={doc.id}
          type="button"
          onClick={() =>
            router.navigate({
              to: "/$slug/documents/$documentId",
              params: { slug, documentId: doc.id },
            })
          }
          className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md p-2 text-left transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {doc.role}
            </p>
          </div>
          <WorkflowStatusBadge status={toWorkflowStatus(doc.workflowStatus)} />
        </button>
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
      {/* Back link */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1"
          onClick={() =>
            router.navigate({ to: "/$slug/contacts", params: { slug } })
          }
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Contacts
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Contact info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>{contact.fullName}</CardTitle>
                <ContactStatusBadge status={contact.status} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={MailIcon} label="Email" value={contact.email} />
                <InfoRow icon={PhoneIcon} label="Phone" value={contact.phone} />
                <InfoRow
                  icon={BuildingIcon}
                  label="Company"
                  value={contact.company}
                />
                <InfoRow icon={UserIcon} label="Title" value={contact.title} />
              </div>

              {contact.notes && (
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-start gap-3">
                    <StickyNoteIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">
                        {contact.notes}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {contact.tags && contact.tags.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-muted-foreground mb-2 text-xs">Tags</p>
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
                    <CalendarIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Created</p>
                      <p className="text-sm">{formatDate(contact.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Updated</p>
                      <p className="text-sm">{formatDate(contact.updatedAt)}</p>
                    </div>
                  </div>
                  {contact.lastContactedAt && (
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Last Contacted
                        </p>
                        <p className="text-sm">
                          {formatDate(contact.lastContactedAt)}
                        </p>
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
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete Contact
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Related documents */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileTextIcon className="h-4 w-4" />
                Related Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<RelatedDocumentsSkeleton />}>
                <RelatedDocumentsContent email={contact.email} slug={slug} />
              </Suspense>
            </CardContent>
          </Card>
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
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{contact.fullName}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}

function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper title="Loading...">
          <div className="mb-6">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-56" />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                  <RelatedDocumentsSkeleton />
                </CardContent>
              </Card>
            </div>
          </div>
        </PageWrapper>
      }
    >
      <ContactDetailContent />
    </Suspense>
  );
}
