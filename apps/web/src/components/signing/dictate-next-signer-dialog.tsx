import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { UserPlus } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import { dictatePublicSigningNextSigner } from "@/lib/api-client";

interface DictateNextSignerDialogProps {
  open: boolean;
  signingToken: string;
  onSuccess: () => void;
  onDefer: () => void;
}

export function DictateNextSignerDialog({
  open,
  signingToken,
  onSuccess,
  onDefer,
}: DictateNextSignerDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setIsSubmitting(true);
    try {
      await dictatePublicSigningNextSigner(signingToken, {
        nextName: name.trim(),
        nextEmail: email.trim().toLowerCase(),
      });
      toast.success("Invitation sent to the next signer");
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send invitation"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onDefer()}
    >
      <Dialog size="sm" className="p-6">
        <div className="flex flex-col items-center">
          <div className="bg-kumo-info-tint mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <UserPlus className="text-kumo-info h-6 w-6" />
          </div>
          <Dialog.Title className="text-center">
            Who should sign next?
          </Dialog.Title>
          <Dialog.Description className="text-center">
            Please designate the next signer. They&apos;ll receive a signing
            invitation immediately.
          </Dialog.Description>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="next-name">Full name</Label>
            <Input
              id="next-name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next-email">Email address</Label>
            <Input
              id="next-email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              required
            />
          </div>

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={onDefer}
              disabled={isSubmitting}
            >
              I&apos;ll do this later
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!name.trim() || !email.trim() || isSubmitting}
              className="sm:ml-auto"
            >
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}
