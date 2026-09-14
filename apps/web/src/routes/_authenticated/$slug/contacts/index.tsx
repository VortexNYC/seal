/**
 * Contacts List Page
 *
 * Displays a searchable, filterable list of organization contacts
 * with bulk selection, bulk delete, CSV export, and inline edit.
 * Route: /{slug}/contacts
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import {
  DotsThreeVertical,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UserPlus,
  Users,
  X,
} from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ContactStatusBadge } from "@/components/contacts/contact-status-badge";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { ExportContacts } from "@/components/contacts/export-contacts";
import { PageWrapper } from "@/components/page-wrapper";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bulkDeleteContacts,
  deleteContact,
  getContacts,
  type ApiContact,
} from "@/lib/api-client";
import type { ContactStatus } from "@/lib/contact-status";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/contacts/")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: pageSEO.contacts.title },
      { name: "description", content: pageSEO.contacts.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type StatusFilter = ContactStatus | "all";

function ContactsTableSkeleton() {
  return (
    <div
      className="overflow-x-auto rounded-lg border"
      role="status"
      aria-label="Loading contacts"
    >
      <Table className="min-w-[600px]">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-10" />
            <Table.Head>Name</Table.Head>
            <Table.Head>Email</Table.Head>
            <Table.Head className="hidden sm:table-cell">Company</Table.Head>
            <Table.Head className="hidden md:table-cell">Title</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head className="text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: 5 }).map((_, i) => (
            <Table.Row key={i}>
              <Table.Cell>
                <Skeleton className="h-4 w-4" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton className="h-4 w-32" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton className="h-4 w-40" />
              </Table.Cell>
              <Table.Cell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </Table.Cell>
              <Table.Cell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </Table.Cell>
              <Table.Cell className="text-right">
                <Skeleton className="ml-auto h-8 w-8" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

// --- Contact table rendering (shared between search and list) ---

interface ContactsTableContentProps {
  contacts: ApiContact[];
  hasFilters: boolean;
  onCreateOpen: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

function ContactsTableContent({
  contacts,
  hasFilters,
  onCreateOpen,
  selectedIds,
  onSelectionChange,
}: ContactsTableContentProps) {
  const { slug } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    contactId: string | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: "",
  });

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [editContact, setEditContact] = useState<ApiContact | null>(null);

  const handleDelete = (contactId: string, contactName: string) => {
    setDeleteDialog({ open: true, contactId, contactName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.contactId) return;

    try {
      await deleteContact(slug, deleteDialog.contactId);
      await queryClient.invalidateQueries({ queryKey: ["api", "contacts"] });
      toast.success("Contact deleted");
      // Remove from selection if selected
      if (selectedIds.has(deleteDialog.contactId)) {
        const next = new Set(selectedIds);
        next.delete(deleteDialog.contactId);
        onSelectionChange(next);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete contact";
      toast.error(errorMessage);
    } finally {
      setDeleteDialog({ open: false, contactId: null, contactName: "" });
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const results = await bulkDeleteContacts(slug, ids);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        toast.warning(`Deleted ${successCount} contacts. ${failCount} failed.`);
      } else {
        toast.success(`Deleted ${successCount} contacts`);
      }
      onSelectionChange(new Set());
      await queryClient.invalidateQueries({ queryKey: ["api", "contacts"] });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete contacts";
      toast.error(errorMessage);
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  };

  const handleOpenContact = (contactId: string) => {
    void router.navigate({
      to: "/$slug/contacts/$contactId",
      params: { slug, contactId },
    });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(contacts.map((c) => c._id)));
    }
  };

  if (contacts.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={MagnifyingGlass}
          title="No contacts found"
          description="Try adjusting your search or filters to find what you're looking for."
        />
      );
    }

    return (
      <EmptyState
        icon={Users}
        title="No contacts yet"
        description="Add your first contact to start building your address book. Contacts can be linked to document recipients."
        action={{
          label: "Add Contact",
          onClick: onCreateOpen,
          icon: UserPlus,
        }}
      />
    );
  }

  const allSelected = selectedIds.size === contacts.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < contacts.length;

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg border p-2">
          <Text as="span" variant="secondary" size="sm">
            {selectedIds.size} selected
          </Text>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete ({selectedIds.size})
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[600px]">
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-10">
                <Table.CheckHead
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleSelectAll}
                  label="Select all contacts"
                />
              </Table.Head>
              <Table.Head>Name</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head className="hidden sm:table-cell">Company</Table.Head>
              <Table.Head className="hidden md:table-cell">Title</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head className="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {contacts.map((contact) => (
              <Table.Row
                key={contact._id}
                className="cursor-pointer"
                variant={selectedIds.has(contact._id) ? "selected" : "default"}
                onClick={() => handleOpenContact(contact._id)}
              >
                <Table.CheckCell
                  checked={selectedIds.has(contact._id)}
                  onCheckedChange={() => toggleSelect(contact._id)}
                  label={`Select ${contact.fullName}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
                <Table.Cell>
                  <p className="text-kumo-default font-medium">
                    {contact.fullName}
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <Text as="p" variant="secondary" size="sm">
                    {contact.email}
                  </Text>
                </Table.Cell>
                <Table.Cell className="hidden sm:table-cell">
                  <Text as="p" size="sm">
                    {contact.company ?? "-"}
                  </Text>
                </Table.Cell>
                <Table.Cell className="hidden md:table-cell">
                  <Text as="p" size="sm">
                    {contact.title ?? "-"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <ContactStatusBadge status={contact.status} />
                </Table.Cell>
                <Table.Cell className="text-right">
                  <DropdownMenu>
                    <DropdownMenu.Trigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Contact actions for ${contact.fullName ?? "selected contact"}`}
                        className="h-8 w-8"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <DotsThreeVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                      align="end"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <DropdownMenu.Item
                        onClick={() => handleOpenContact(contact._id)}
                      >
                        Open
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={() => setEditContact(contact)}
                        icon={PencilSimple}
                      >
                        Edit
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={() =>
                          handleDelete(contact._id, contact.fullName)
                        }
                        variant="danger"
                        icon={Trash}
                      >
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Single delete confirmation */}
      <Dialog.Root
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, contactId: null, contactName: "" })
        }
        role="alertdialog"
      >
        <Dialog size="sm" className="p-6">
          <div className="space-y-1.5">
            <Dialog.Title>Delete Contact</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to delete &ldquo;{deleteDialog.contactName}
              &rdquo;? This action cannot be undone.
            </Dialog.Description>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDeleteDialog({
                  open: false,
                  contactId: null,
                  contactName: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Bulk delete confirmation */}
      <Dialog.Root
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        role="alertdialog"
      >
        <Dialog size="sm" className="p-6">
          <div className="space-y-1.5">
            <Dialog.Title>Delete {selectedIds.size} Contacts</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to delete {selectedIds.size} contacts? This
              action cannot be undone.
            </Dialog.Description>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting
                ? "Deleting..."
                : `Delete ${selectedIds.size} Contacts`}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Edit dialog */}
      {editContact && (
        <EditContactDialog
          organizationSlug={slug}
          open={!!editContact}
          onOpenChange={(open) => {
            if (!open) setEditContact(null);
          }}
          contact={editContact}
          onUpdated={() =>
            queryClient.invalidateQueries({ queryKey: ["api", "contacts"] })
          }
        />
      )}
    </>
  );
}

// --- Data-fetching components (separate to avoid conditional hook calls) ---

function ContactsListData({
  statusFilter,
  onCreateOpen,
  selectedIds,
  onSelectionChange,
  onContactsLoaded,
}: {
  statusFilter: StatusFilter;
  onCreateOpen: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onContactsLoaded: (contacts: ApiContact[]) => void;
}) {
  const { slug } = Route.useParams();
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery({
    queryKey: ["api", "contacts", "list", statusArg ?? "all", slug],
    queryFn: () => getContacts(slug, { status: statusArg }),
  });

  // Notify parent of loaded contacts for export
  useEffect(() => {
    onContactsLoaded(contacts ?? []);
  }, [contacts, onContactsLoaded]);

  return (
    <ContactsTableContent
      contacts={contacts ?? []}
      hasFilters={statusFilter !== "all"}
      onCreateOpen={onCreateOpen}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}

function ContactsSearchData({
  query,
  statusFilter,
  onCreateOpen,
  selectedIds,
  onSelectionChange,
  onContactsLoaded,
}: {
  query: string;
  statusFilter: StatusFilter;
  onCreateOpen: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onContactsLoaded: (contacts: ApiContact[]) => void;
}) {
  const { slug } = Route.useParams();
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery({
    queryKey: ["api", "contacts", "search", query, statusArg ?? "all", slug],
    queryFn: () => getContacts(slug, { search: query, status: statusArg }),
  });

  useEffect(() => {
    onContactsLoaded(contacts ?? []);
  }, [contacts, onContactsLoaded]);

  return (
    <ContactsTableContent
      contacts={contacts ?? []}
      hasFilters
      onCreateOpen={onCreateOpen}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}

// --- Page component ---

function ContactsPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadedContacts, setLoadedContacts] = useState<ApiContact[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, debouncedSearch]);

  const handleCreateOpen = () => setCreateOpen(true);

  const handleContactsLoaded = useCallback((contacts: ApiContact[]) => {
    setLoadedContacts(contacts);
  }, []);

  return (
    <PageWrapper
      title="Contacts"
      action={{
        label: "Add Contact",
        onClick: handleCreateOpen,
        icon: UserPlus,
        variant: "default",
      }}
      headerActions={<ExportContacts contacts={loadedContacts} />}
    >
      <div className="space-y-6">
        {/* Search Input */}
        <div className="bg-card/60 relative rounded-lg border px-2 py-2">
          <MagnifyingGlass className="text-kumo-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search contacts by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-9 pl-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Clear search"
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearchInput("")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="self-center">
            <Text as="span" variant="secondary" size="sm">
              Status:
            </Text>
          </span>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "primary" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "primary" : "outline"}
            onClick={() => setStatusFilter("active")}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "inactive" ? "primary" : "outline"}
            onClick={() => setStatusFilter("inactive")}
          >
            Inactive
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "lead" ? "primary" : "outline"}
            onClick={() => setStatusFilter("lead")}
          >
            Lead
          </Button>
        </div>

        {/* Contacts List with Suspense */}
        <Suspense fallback={<ContactsTableSkeleton />}>
          {debouncedSearch ? (
            <ContactsSearchData
              query={debouncedSearch}
              statusFilter={statusFilter}
              onCreateOpen={handleCreateOpen}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onContactsLoaded={handleContactsLoaded}
            />
          ) : (
            <ContactsListData
              statusFilter={statusFilter}
              onCreateOpen={handleCreateOpen}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onContactsLoaded={handleContactsLoaded}
            />
          )}
        </Suspense>

        <CreateContactDialog
          organizationSlug={slug}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["api", "contacts"] })
          }
        />
      </div>
    </PageWrapper>
  );
}
