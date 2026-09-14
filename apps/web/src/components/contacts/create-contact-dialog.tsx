/**
 * Create Contact Dialog
 *
 * Dialog for creating a new contact with form validation.
 * Checks for duplicate emails and shows a warning toast if one exists.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  createContact,
  getContactByEmail,
  type ApiContact,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (contact: ApiContact) => void;
  organizationSlug: string;
}

const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Please enter a valid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["active", "inactive", "lead"]),
  notes: z.string().optional(),
});

type CreateContactFormValues = z.infer<typeof createContactSchema>;

export function CreateContactDialog({
  open,
  onOpenChange,
  onCreated,
  organizationSlug,
}: CreateContactDialogProps) {
  const [emailToCheck, setEmailToCheck] = useState("");
  const [existingContact, setExistingContact] = useState<ApiContact | null>(
    null
  );

  const form = useForm<CreateContactFormValues>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      title: "",
      status: "active",
      notes: "",
    },
  });

  const duplicateWarning = emailToCheck && existingContact;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setEmailToCheck("");
      setExistingContact(null);
    }
  }, [open, form]);

  const handleCheckEmail = async (email: string) => {
    const trimmed = email.trim();
    const valid = createContactSchema.shape.email.safeParse(trimmed).success;
    if (!valid) {
      setEmailToCheck("");
      setExistingContact(null);
      return;
    }
    setEmailToCheck(trimmed);
    try {
      const contact = await getContactByEmail(organizationSlug, trimmed);
      setExistingContact(contact);
    } catch {
      setExistingContact(null);
    }
  };

  const handleSubmit = async (values: CreateContactFormValues) => {
    try {
      const contact = await createContact(organizationSlug, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        company: values.company?.trim() || undefined,
        title: values.title?.trim() || undefined,
        status: values.status,
        notes: values.notes?.trim() || undefined,
      });

      onCreated?.(contact);

      if (existingContact) {
        toast.warning(
          "A contact with this email already exists. A duplicate was created."
        );
      } else {
        toast.success("Contact created");
      }

      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create contact";
      toast.error(errorMessage);
    }
  };

  const requiredAsterisk = (
    <span className="text-kumo-danger" aria-hidden="true">
      {" "}
      *
    </span>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="p-6">
        <div className="space-y-1.5">
          <Dialog.Title>Add Contact</Dialog.Title>
          <Dialog.Description>
            Create a new contact for your organization.
          </Dialog.Description>
        </div>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="mt-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={form.control}
              name="firstName"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label={
                    <>
                      First Name
                      {requiredAsterisk}
                    </>
                  }
                  placeholder="John"
                  error={fieldState.error?.message}
                />
              )}
            />

            <Controller
              control={form.control}
              name="lastName"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label={
                    <>
                      Last Name
                      {requiredAsterisk}
                    </>
                  }
                  placeholder="Doe"
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="email"
                label={
                  <>
                    Email
                    {requiredAsterisk}
                  </>
                }
                placeholder="john@example.com"
                error={fieldState.error?.message}
                onBlur={() => {
                  field.onBlur();
                  void handleCheckEmail(field.value);
                }}
                description={
                  duplicateWarning ? (
                    <span className="text-kumo-warning">
                      A contact with this email already exists.
                    </span>
                  ) : undefined
                }
              />
            )}
          />

          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Input
                {...field}
                type="tel"
                label="Phone"
                placeholder="+1 (555) 000-0000"
              />
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={form.control}
              name="company"
              render={({ field }) => (
                <Input {...field} label="Company" placeholder="Acme Inc." />
              )}
            />

            <Controller
              control={form.control}
              name="title"
              render={({ field }) => (
                <Input {...field} label="Title" placeholder="CEO" />
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                label="Status"
                value={field.value}
                onValueChange={field.onChange}
                items={{
                  active: "Active",
                  inactive: "Inactive",
                  lead: "Lead",
                }}
              />
            )}
          />

          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <Textarea
                {...field}
                label="Notes"
                placeholder="Add any notes about this contact..."
                rows={3}
              />
            )}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}
