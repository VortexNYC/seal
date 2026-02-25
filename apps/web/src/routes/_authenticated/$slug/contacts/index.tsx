/**
 * Contacts List Page
 *
 * Displays a searchable, filterable list of organization contacts.
 * Route: /{slug}/contacts
 */

import { convexQuery } from "@convex-dev/react-query";
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
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
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
import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import type { ContactStatus } from "@seal/backend/convex/schemas/contacts";

export const Route = createFileRoute("/_authenticated/$slug/contacts/")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: pageSEO.documents.title.replace("Documents", "Contacts") },
      { name: "description", content: "Manage your organization contacts" },
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

function StatusBadge({ status }: { status: ContactStatus }) {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "inactive":
      return <Badge variant="secondary">Inactive</Badge>;
    case "lead":
      return <Badge variant="outline">Lead</Badge>;
  }
}

// --- Contact table rendering (shared between search and list) ---

interface ContactsTableContentProps {
  contacts: Doc<"contacts">[];
  hasFilters: boolean;
  onCreateOpen: () => void;
}

function ContactsTableContent({ contacts, hasFilters, onCreateOpen }: ContactsTableContentProps) {
  const { slug } = Route.useParams();
  const router = useRouter();
  const deleteContact = useMutation(api.contacts.mutations.remove);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    contactId: Id<"contacts"> | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: "",
  });

  const handleDelete = (contactId: Id<"contacts">, contactName: string) => {
    setDeleteDialog({ open: true, contactId, contactName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.contactId) return;

    try {
      await deleteContact({ id: deleteDialog.contactId });
      toast.success("Contact deleted");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete contact";
      toast.error(errorMessage);
    } finally {
      setDeleteDialog({ open: false, contactId: null, contactName: "" });
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

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
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
                onClick={() =>
                  router.navigate({
                    to: `/${slug}/contacts/${contact._id}`,
                  })
                }
              >
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
                  <StatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem disabled>
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
    </>
  );
}

// --- Data-fetching components (separate to avoid conditional hook calls) ---

function ContactsListData({
  statusFilter,
  onCreateOpen,
}: {
  statusFilter: StatusFilter;
  onCreateOpen: () => void;
}) {
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery(
    convexQuery(api.contacts.queries.list, { status: statusArg }),
  );

  return (
    <ContactsTableContent
      contacts={contacts}
      hasFilters={statusFilter !== "all"}
      onCreateOpen={onCreateOpen}
    />
  );
}

function ContactsSearchData({
  query,
  statusFilter,
  onCreateOpen,
}: {
  query: string;
  statusFilter: StatusFilter;
  onCreateOpen: () => void;
}) {
  const statusArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: contacts } = useSuspenseQuery(
    convexQuery(api.contacts.queries.search, { query, status: statusArg }),
  );

  return (
    <ContactsTableContent contacts={contacts} hasFilters onCreateOpen={onCreateOpen} />
  );
}

// --- Page component ---

function ContactsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCreateOpen = () => setCreateOpen(true);

  return (
    <PageWrapper
      title="Contacts"
      action={{
        label: "Add Contact",
        onClick: handleCreateOpen,
        icon: UserPlusIcon,
        variant: "default",
      }}
    >
      <div className="space-y-6">
        {/* Search Input */}
        <div className="relative">
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
            />
          ) : (
            <ContactsListData statusFilter={statusFilter} onCreateOpen={handleCreateOpen} />
          )}
        </Suspense>

        <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </PageWrapper>
  );
}
