import usePresence from "@convex-dev/presence/react";
import { api } from "@seal/backend/convex/_generated/api";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";
import { getInitials } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface DocumentPresenceProps {
  documentId: string;
}

export function DocumentPresence({ documentId }: DocumentPresenceProps) {
  const { user } = useUser();
  const presenceState = usePresence(api.presence, `document:${documentId}`, user?.id ?? "");

  if (!user || !presenceState || presenceState.length <= 1) {
    return null;
  }

  // Filter out current user — they know they're here
  const others = presenceState.filter((p) => p.userId !== user.id && p.online);

  if (others.length === 0) {
    return null;
  }

  const visible = others.slice(0, 3);
  const overflow = others.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((entry) => (
        <Tooltip key={entry.userId}>
          <TooltipTrigger asChild>
            <Avatar
              className={cn(
                // vortex-allow-color: presence avatar ring separates from any underlying color; white by design
                "size-7 ring-2 ring-white dark:ring-stone-950",
                "transition-transform hover:z-10 hover:scale-110",
              )}
            >
              {entry.image && <AvatarImage src={entry.image} alt={entry.name ?? "User"} />}
              <AvatarFallback className="bg-success-surface text-success text-xs font-medium">
                {getInitials(entry.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {entry.name ?? "Unknown user"}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full",
                "bg-muted text-muted-foreground text-xs font-medium",
                "ring-background ring-2",
              )}
            >
              +{overflow}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {overflow} more {overflow === 1 ? "viewer" : "viewers"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
