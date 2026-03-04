import { useMutation, useQuery } from "convex/react";
import { CheckIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { cn, getErrorMessage } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const outsiderSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

interface AddRecipientDialogProps {
  documentId: Id<"documents">;
  organizationId: Id<"organizations">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  existingRecipientEmails?: string[];
  currentUserEmail?: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function AddRecipientDialog({
  documentId,
  organizationId,
  open,
  onOpenChange,
  onSuccess,
  existingRecipientEmails = [],
  currentUserEmail,
}: AddRecipientDialogProps) {
  const [activeTab, setActiveTab] = useState<"team" | "outsider">("team");
  const [selectedMember, setSelectedMember] = useState<{
    id: Id<"organization_members">;
    email: string;
    name: string | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"signer" | "viewer" | "approver">("signer");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const members = useQuery(
    api.organizations.queries.getOrganizationMembers,
    open ? { organizationId } : "skip",
  );

  const contactSuggestions = useQuery(
    api.contacts.queries.suggestForRecipient,
    activeTab === "outsider" && email.length >= 2 ? { searchTerm: email } : "skip",
  );

  // Filter out contacts whose emails are already added as recipients
  const filteredSuggestions = contactSuggestions?.filter(
    (c) => !existingRecipientEmails.some((e) => e.toLowerCase() === c.email.toLowerCase()),
  );

  const addRecipients = useMutation(api.documents.recipients_mutations.addRecipients);

  // Filter out current user and already-added recipients
  const eligibleMembers = members?.filter((member) => {
    const memberEmail = member.email?.toLowerCase();
    if (!memberEmail) return false;
    // Filter out current user
    if (currentUserEmail && memberEmail === currentUserEmail.toLowerCase()) {
      return false;
    }
    // Filter out already added recipients
    if (existingRecipientEmails.some((e) => e.toLowerCase() === memberEmail)) {
      return false;
    }
    // Only include active members
    if (member.status !== "active") {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let recipientEmail: string;
    let recipientName: string | undefined;

    if (activeTab === "team") {
      if (!selectedMember) {
        toast.error("Please select a team member");
        return;
      }
      recipientEmail = selectedMember.email.toLowerCase().trim();
      recipientName = selectedMember.name || undefined;
    } else {
      const validation = outsiderSchema.safeParse({ email: email.trim() });
      if (!validation.success) {
        setEmailError(validation.error.issues[0].message);
        return;
      }
      setEmailError(null);
      recipientEmail = email.toLowerCase().trim();
      recipientName = name.trim() || undefined;
    }

    setLoading(true);

    try {
      await addRecipients({
        documentId,
        recipients: [
          {
            email: recipientEmail,
            name: recipientName,
            role,
          },
        ],
      });

      toast.success("Recipient added successfully");
      // Reset form
      setEmail("");
      setName("");
      setRole("signer");
      setSelectedMember(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to add recipient", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading ||
    (activeTab === "team" && !selectedMember) ||
    (activeTab === "outsider" && (!email || !email.includes("@")));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Recipient</DialogTitle>
          <DialogDescription>
            Add a person who needs to take action on this document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "team" | "outsider")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="team">
                Team{eligibleMembers ? ` (${eligibleMembers.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="outsider">External</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="space-y-4">
              {members === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : eligibleMembers && eligibleMembers.length > 0 ? (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border p-2">
                  {eligibleMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() =>
                        setSelectedMember({
                          id: member.id,
                          email: member.email,
                          name: member.name ?? null,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedMember({
                            id: member.id,
                            email: member.email,
                            name: member.name ?? null,
                          });
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors",
                        selectedMember?.id === member.id && "bg-accent",
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name || "Unknown"}</p>
                        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                      </div>
                      {selectedMember?.id === member.id && (
                        <CheckIcon className="text-primary h-4 w-4 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UsersIcon className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    {existingRecipientEmails.length > 0
                      ? "All team members have been added"
                      : "No team members available"}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="outsider" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setShowSuggestions(true);
                      if (emailError) setEmailError(null);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                  />
                  {showSuggestions && filteredSuggestions && filteredSuggestions.length > 0 && (
                    <div className="bg-popover absolute top-full left-0 z-50 mt-1 w-full rounded-md border p-1 shadow-md">
                      {filteredSuggestions.map((contact) => (
                        <div
                          key={contact._id}
                          role="button"
                          tabIndex={0}
                          className="hover:bg-accent flex cursor-pointer flex-col rounded-sm px-2 py-1.5 text-sm"
                          onClick={() => {
                            setEmail(contact.email);
                            setName(contact.fullName);
                            setShowSuggestions(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setEmail(contact.email);
                              setName(contact.fullName);
                              setShowSuggestions(false);
                            }
                          }}
                        >
                          <span className="font-medium">{contact.fullName}</span>
                          <span className="text-muted-foreground text-xs">{contact.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {emailError && <p className="text-destructive text-sm">{emailError}</p>}

              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signer">Signer (Must sign)</SelectItem>
                <SelectItem value="viewer">Viewer (View only)</SelectItem>
                <SelectItem value="approver">Approver (Must approve)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {role === "signer" && "This person must sign the document."}
              {role === "viewer" && "This person can only view the document."}
              {role === "approver" && "This person must approve before signing can proceed."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {loading ? "Adding..." : "Add Recipient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
