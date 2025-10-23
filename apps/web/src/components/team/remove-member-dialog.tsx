/**
 * Remove Member Dialog Component
 *
 * Confirmation dialog for removing a member from the organization
 */

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@seal/backend/convex/_generated/api';
import type { Id } from '@seal/backend/convex/_generated/dataModel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: Id<'organization_members'>;
  name: string | null;
  email: string;
}

interface RemoveMemberDialogProps {
  member: Member;
  organizationId: Id<'organizations'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveMemberDialog({
  member,
  organizationId,
  open,
  onOpenChange,
}: RemoveMemberDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeMember = useMutation(api.organizations.mutations.removeMember);

  const handleRemove = async () => {
    setError(null);
    setIsRemoving(true);

    try {
      await removeMember({
        memberId: member.id,
      });

      toast.success('Member removed', {
        description: `${member.name || member.email} has been removed from the workspace`,
      });

      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      toast.error('Failed to remove member', {
        description: errorMessage,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove team member?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{member.name || member.email}</strong> from this
            workspace? They will lose access to all documents and settings.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving ? 'Removing...' : 'Remove Member'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
