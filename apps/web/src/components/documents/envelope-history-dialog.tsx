import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { type ReactElement } from "react";

import type { ActivityEvent } from "@/lib/document-activity";

function formatActivityTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function EnvelopeHistoryDialog({
  open,
  onOpenChange,
  documentName,
  events,
  completed,
  onDownloadCertificate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  events: ActivityEvent[];
  completed: boolean;
  onDownloadCertificate: () => void;
}): ReactElement {
  const ordered = events.toSorted((a, b) => a.timestamp - b.timestamp);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title>Envelope history</Dialog.Title>
        <Dialog.Description>
          What has happened to {documentName}.
        </Dialog.Description>
        <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {ordered.map((event) => (
            <li key={`${event.type}-${event.timestamp}-${event.description}`}>
              <p className="text-sm font-medium">{event.description}</p>
              <p className="text-xs opacity-70">
                {formatActivityTime(event.timestamp)}
              </p>
            </li>
          ))}
        </ul>
        {completed ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              onClick={onDownloadCertificate}
            >
              Download certificate
            </Button>
          </div>
        ) : null}
      </Dialog>
    </Dialog.Root>
  );
}
