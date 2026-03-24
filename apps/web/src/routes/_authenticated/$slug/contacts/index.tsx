/**
 * Contacts List Page
 *
 * Displays a searchable, filterable list of organization contacts
 * with bulk selection, bulk delete, CSV export, and inline edit.
 * Route: /{slug}/contacts
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import type { ContactStatus } from "@seal/backend/convex/schemas/contacts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  MoreVerticalIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ContactStatusBadge } from "@/components/contacts/contact-status-badge";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { ExportContacts } from "@/components/contacts/export-contacts";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="overflow-x-auto rounded-lg border" role="status" aria-label="Loading contacts">
      <Table className="min-w-[600px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="hidden sm:table-cell">Company</TableHead>
            <TableHead className="hidden md:table-cell">Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- Contact table rendering (shared between search and list) ---

interface ContactsTableContentProps {
  contacts: Doc<"contacts">[];
  hasFilters: boolean;
  onCreateOpen: () => void;
  selectedIds: Set<Id<"contacts">>;
  onSelectionChange: (ids: Set<Id<"contacts">>) => void;
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
  const deleteContact = useMutation(api.contacts.mutations.remove);
  const bulkDeleteContacts = useMutation(api.contacts.mutations.bulkDelete);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    contactId: Id<"contacts"> | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: "",
  });

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [editContact, setEditContact] = useState<Doc<"contacts"> | null>(null);

  const handleDelete = (contactId: Id<"contacts">, contactName: string) => {
    setDeleteDialog({ open: true, contactId, contactName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.contactId) return;

    try {
      await deleteContact({ id: deleteDialog.contactId });
      toast.success("Contact deleted");
      // Remove from selection if selected
      if (selectedIds.has(deleteDialog.contactId)) {
        const next = new Set(selectedIds);
        next.delete(deleteDialog.contactId);
        onSelectionChange(next);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete contact";
      toast.error(errorMessage);
    } finally {
      setDeleteDialog({ open: false, contactId: null, contactName: "" });
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const results = await bulkDeleteContacts({ ids });
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        toast.warning(`Deleted ${successCount} contacts. ${failCount} failed.`);
      } else {
        toast.success(`Deleted ${successCount} contacts`);
      }
      onSelectionChange(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete contacts";
      toast.error(errorMessage);
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  };

  const handleOpenContact = (contactId: Id<"contacts">) => {
    router.navigate({
      to: `/${slug}/contacts/${contactId}`,
    });
  };

  const toggleSelect = (id: Id<"contacts">) => {
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
          icon={SearchIcon}
          title="No contacts found"
          description="Try adjusting your search or filters to find what you're looking for."
        />
      );
    }

    return (
      <EmptyState
        icon={UsersIcon}
        title="No contacts yet"
        description="Add your first contact to start building your address book. Contacts can be linked to document recipients."
        action={{
          label: "Add Contact",
          onClick: onCreateOpen,
          icon: UserPlusIcon,
        }}
      />
    );
  }

  const allSelected = selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length;

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg border p-2">
          <span className="text-muted-foreground text-sm">{selectedIds.size} selected</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            Delete ({selectedIds.size})
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all contacts"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden sm:table-cell">Company</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact._id}
                className="hover:bg-muted/50 cursor-pointer"
                data-state={selectedIds.has(contact._id) ? "selected" : undefined}
                onClick={() => handleOpenContact(contact._id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(contact._id)}
                    onCheckedChange={() => toggleSelect(contact._id)}
                    aria-label={`Select ${contact.fullName}`}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{contact.fullName}</p>
                </TableCell>
                <TableCell>
                  <p className="text-muted-foreground text-sm">{contact.email}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <p className="text-sm">{contact.company ?? "-"}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="text-sm">{contact.title ?? "-"}</p>
                </TableCell>
                <TableCell>
                  <ContactStatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Contact actions for ${contact.fullName ?? "selected contact"}`}
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleOpenContact(contact._id)}>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditContact(contact)}>
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(contact._id, contact.fullName)}
                        className="text-destructive"
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Single delete confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, contactId: null, contactName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteDialog.contactName}&rdquo;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} contacts? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              variant="destructive"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} Contacts`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      {editContact && (
        <EditContactDialog
          open={!!editContact}
          onOpenChange={(open) => {
            if (!open) setEditContact(null);
          }}
          contact={editContact}
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
  selectedIds: Set<Id<"contacts">>;
  onSelectionChange: (ids: Set<Id<"contacts">>) => void;
  onContactsLoaded: (contacts: Doc<"contacts">[]) => void;
}) {
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery(
    convexQuery(api.contacts.queries.list, { status: statusArg }),
  );

  // Notify parent of loaded contacts for export
  useEffect(() => {
    onContactsLoaded(contacts);
  }, [contacts, onContactsLoaded]);

  return (
    <ContactsTableContent
      contacts={contacts}
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
  selectedIds: Set<Id<"contacts">>;
  onSelectionChange: (ids: Set<Id<"contacts">>) => void;
  onContactsLoaded: (contacts: Doc<"contacts">[]) => void;
}) {
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery(
    convexQuery(api.contacts.queries.search, { query, status: statusArg }),
  );

  useEffect(() => {
    onContactsLoaded(contacts);
  }, [contacts, onContactsLoaded]);

  return (
    <ContactsTableContent
      contacts={contacts}
      hasFilters
      onCreateOpen={onCreateOpen}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}

// --- Page component ---

function ContactsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"contacts">>>(new Set());
  const [loadedContacts, setLoadedContacts] = useState<Doc<"contacts">[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, debouncedSearch]);

  const handleCreateOpen = () => setCreateOpen(true);

  const handleContactsLoaded = useCallback((contacts: Doc<"contacts">[]) => {
    setLoadedContacts(contacts);
  }, []);

  return (
    <PageWrapper
      title="Contacts"
      action={{
        label: "Add Contact",
        onClick: handleCreateOpen,
        icon: UserPlusIcon,
        variant: "default",
      }}
      headerActions={<ExportContacts contacts={loadedContacts} />}
    >
      <div className="space-y-6">
        {/* Search Input */}
        <div className="bg-card/60 relative rounded-lg border px-2 py-2">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
              size="icon"
              aria-label="Clear search"
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearchInput("")}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground self-center text-sm">Status:</span>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => setStatusFilter("active")}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "inactive" ? "default" : "outline"}
            onClick={() => setStatusFilter("inactive")}
          >
            Inactive
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "lead" ? "default" : "outline"}
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

        <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </PageWrapper>
  );
}
