/**
 * Edit Contact Dialog
 *
 * Dialog for editing an existing contact with pre-populated form data.
 * Calls api.contacts.mutations.update with the changed fields.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { useEffect, useState } from "react";

import { updateContact, type ApiContact } from "@/lib/api-client";
import type { ContactStatus } from "@/lib/contact-status";
import { parseSelectValue } from "@/lib/select-values";
import { toast } from "@/lib/toast";

const CONTACT_STATUSES = [
  "active",
  "inactive",
  "lead",
] as const satisfies readonly ContactStatus[];

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ApiContact;
  onUpdated?: (contact: ApiContact) => void;
  organizationSlug: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onUpdated,
  organizationSlug,
}: EditContactDialogProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [company, setCompany] = useState(contact.company ?? "");
  const [title, setTitle] = useState(contact.title ?? "");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-populate form when contact prop changes
  useEffect(() => {
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setEmail(contact.email);
    setPhone(contact.phone ?? "");
    setCompany(contact.company ?? "");
    setTitle(contact.title ?? "");
    setStatus(contact.status);
    setNotes(contact.notes ?? "");
    setErrors({});
  }, [contact]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const updated = await updateContact(organizationSlug, contact._id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        title: title.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      });

      onUpdated?.(updated);
      toast.success("Contact updated");
      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update contact";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
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
          <Dialog.Title>Edit Contact</Dialog.Title>
          <Dialog.Description>
            Update this contact&apos;s information.
          </Dialog.Description>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="edit-firstName"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (errors.firstName)
                  setErrors((prev) => ({ ...prev, firstName: undefined }));
              }}
              label={
                <>
                  First Name
                  {requiredAsterisk}
                </>
              }
              placeholder="John"
              error={errors.firstName}
            />

            <Input
              id="edit-lastName"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (errors.lastName)
                  setErrors((prev) => ({ ...prev, lastName: undefined }));
              }}
              label={
                <>
                  Last Name
                  {requiredAsterisk}
                </>
              }
              placeholder="Doe"
              error={errors.lastName}
            />
          </div>

          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email)
                setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            label={
              <>
                Email
                {requiredAsterisk}
              </>
            }
            placeholder="john@example.com"
            error={errors.email}
          />

          <Input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            label="Phone"
            placeholder="+1 (555) 000-0000"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="edit-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              label="Company"
              placeholder="Acme Inc."
            />

            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              label="Title"
              placeholder="CEO"
            />
          </div>

          <Select
            label="Status"
            value={status}
            onValueChange={(value) => {
              if (!value) return;
              const parsed = parseSelectValue(value, CONTACT_STATUSES);
              if (parsed) {
                setStatus(parsed);
              }
            }}
            items={{
              active: "Active",
              inactive: "Inactive",
              lead: "Lead",
            }}
          />

          <Textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            label="Notes"
            placeholder="Add any notes about this contact..."
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}
