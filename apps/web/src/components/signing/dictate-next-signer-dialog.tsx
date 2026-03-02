import { useMutation } from "convex/react";
import { UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@seal/backend/convex/_generated/api";

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
  const dictateNextRecipient = useMutation(api.documents.recipients_mutations.dictateNextRecipient);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setIsSubmitting(true);
    try {
      await dictateNextRecipient({
        signingToken,
        nextName: name.trim(),
        nextEmail: email.trim().toLowerCase(),
      });
      toast.success("Invitation sent to the next signer");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
            <UserPlusIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-center">Who should sign next?</DialogTitle>
          <DialogDescription className="text-center">
            Please designate the next signer. They&apos;ll receive a signing invitation immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="next-name">Full name</Label>
            <Input
              id="next-name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
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
              required
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDefer}
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors hover:no-underline"
            >
              I&apos;ll do this later
            </button>
            <Button
              type="submit"
              disabled={!name.trim() || !email.trim() || isSubmitting}
              className="sm:ml-auto"
            >
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
