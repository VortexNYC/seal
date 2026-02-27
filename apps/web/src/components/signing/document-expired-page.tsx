import { ClockIcon } from "lucide-react";

import { SealLogo } from "@/components/seal-logo";

interface DocumentExpiredPageProps {
  ownerName: string;
}

export function DocumentExpiredPage({ ownerName }: DocumentExpiredPageProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 text-center">
        <SealLogo className="mx-auto h-10 w-auto" />

        <div className="rounded-lg border bg-white p-8 shadow-sm dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ClockIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-balance">This document has expired</h1>

          <p className="text-muted-foreground mt-2 text-sm text-pretty">
            The sender set an expiration date that has passed. Please contact{" "}
            <span className="font-medium">{ownerName}</span> for a new signing link.
          </p>
        </div>
      </div>
    </div>
  );
}
