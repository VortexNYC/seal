/**
 * Invite Member Dialog Component
 *
 * Modal for inviting new members to the organization
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inviteMemberSchema = z.object({
  email: z.email("Please enter a valid email address"),
  role: z.enum(["admin", "member", "viewer"]),
});

type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

interface InviteMemberDialogProps {
  organizationId: Id<"organizations">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  organizationId: _organizationId,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const clerkInvite = useAction(api.organizations.actions.clerkInvite);

  const form = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "member" },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  const handleSubmit = async (values: InviteMemberFormValues) => {
    try {
      const result = await clerkInvite({
        email: values.email.trim().toLowerCase(),
        role: values.role,
        organizationId: _organizationId,
      });

      if (result.ok) {
        toast.success("Invitation sent", {
          description: `An invitation has been sent to ${values.email} via email`,
        });
        onOpenChange(false);
      } else {
        form.setError("root", { message: result.message || "Failed to send invitation" });
        toast.error("Failed to send invitation", { description: result.message });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invitation";
      form.setError("root", { message: errorMessage });
      toast.error("Failed to send invitation", { description: errorMessage });
    }
  };

  const rootError = form.formState.errors.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join this workspace. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            {rootError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{rootError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="colleague@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    We'll send them an invitation to join your workspace
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Viewer</span>
                          <span className="text-muted-foreground text-xs">
                            Can view documents and signatures
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Member</span>
                          <span className="text-muted-foreground text-xs">
                            Can create and send documents
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Admin</span>
                          <span className="text-muted-foreground text-xs">
                            Can manage team and settings
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
