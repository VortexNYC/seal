import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { addRecipients, getContacts } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";

import { parseSelectValue } from "../../lib/select-values";

const RECIPIENT_TABS = ["team", "outsider"] as const;
const RECIPIENT_ROLES = ["signer", "viewer", "approver"] as const;

const outsiderSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

interface AddRecipientDialogProps {
  documentPublicId: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  existingRecipientEmails?: string[];
  currentUserEmail?: string;
  organizationSlug: string;
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
  documentPublicId,
  slug,
  open,
  onOpenChange,
  onSuccess,
  existingRecipientEmails = [],
  currentUserEmail,
  organizationSlug,
}: AddRecipientDialogProps) {
  const [activeTab, setActiveTab] = useState<"team" | "outsider">("team");
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    email: string;
    name: string | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"signer" | "viewer" | "approver">("signer");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: members } = useOrganizationMembers(slug, open);

  const { data: contactSuggestions } = useQuery({
    queryKey: ["contacts", "suggest", email],
    queryFn: () => getContacts(organizationSlug, { search: email }),
    enabled: activeTab === "outsider" && email.length >= 2,
  });

  // Filter out contacts whose emails are already added as recipients
  const filteredSuggestions = contactSuggestions?.filter(
    (c) =>
      !existingRecipientEmails.some(
        (e) => e.toLowerCase() === c.email.toLowerCase()
      )
  );

  const addRecipient = useMutation({
    mutationFn: (input: {
      email: string;
      name?: string;
      role: "signer" | "viewer" | "approver";
    }) => addRecipients(organizationSlug, documentPublicId, [input]),
  });

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
      await addRecipient.mutateAsync({
        email: recipientEmail,
        name: recipientName,
        role,
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Add Recipient</Dialog.Title>
        <Dialog.Description>
          Add a person who needs to take action on this document.
        </Dialog.Description>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs
            tabs={[
              {
                value: "team",
                label: `Team${
                  eligibleMembers ? ` (${eligibleMembers.length})` : ""
                }`,
              },
              { value: "outsider", label: "External" },
            ]}
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(parseSelectValue(v, RECIPIENT_TABS) ?? activeTab)
            }
            listClassName="grid w-full grid-cols-2"
          />

          {activeTab === "team" && (
            <div className="space-y-4">
              {members === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : eligibleMembers && eligibleMembers.length > 0 ? (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border p-2">
                  {eligibleMembers.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() =>
                        setSelectedMember({
                          id: member.userId,
                          email: member.email,
                          name: member.name ?? null,
                        })
                      }
                      className={cn(
                        "hover:bg-accent flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
                        selectedMember?.id === member.userId && "bg-accent"
                      )}
                    >
                      <div className="from-primary to-primary/70 text-primary-foreground flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(member.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.name || "Unknown"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {member.email}
                        </p>
                      </div>
                      {selectedMember?.id === member.userId && (
                        <CheckIcon className="text-primary h-4 w-4 shrink-0" />
                      )}
                    </button>
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
            </div>
          )}

          {activeTab === "outsider" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={email}
                    aria-label="Email address"
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
                  {showSuggestions &&
                    filteredSuggestions &&
                    filteredSuggestions.length > 0 && (
                      <div className="bg-popover absolute top-full left-0 z-50 mt-1 w-full rounded-md border p-1 shadow-md">
                        {filteredSuggestions.map((contact) => (
                          <button
                            key={contact._id}
                            type="button"
                            className="hover:bg-accent flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm"
                            onClick={() => {
                              setEmail(contact.email);
                              setName(contact.fullName);
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="font-medium">
                              {contact.fullName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {contact.email}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
              {emailError && (
                <p className="text-destructive text-sm">{emailError}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  aria-label="Full name"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Select
              value={role}
              label="Role"
              onValueChange={(v) => {
                if (!v) return;
                setRole(parseSelectValue(v, RECIPIENT_ROLES) ?? role);
              }}
            >
              <Select.Option value="signer">Signer (Must sign)</Select.Option>
              <Select.Option value="viewer">Viewer (View only)</Select.Option>
              <Select.Option value="approver">
                Approver (Must approve)
              </Select.Option>
            </Select>
            <p className="text-muted-foreground text-xs">
              {role === "signer" && "This person must sign the document."}
              {role === "viewer" && "This person can only view the document."}
              {role === "approver" &&
                "This person must approve before signing can proceed."}
            </p>
          </div>

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitDisabled}>
              {loading ? "Adding..." : "Add Recipient"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}
