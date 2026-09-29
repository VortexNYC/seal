/**
 * Shown when Needs Attention is empty — still answers “what needs me?”
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CheckCircle, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";

interface AllClearProps {
  slug: string;
}

export function AllClear({ slug }: AllClearProps): ReactElement {
  const router = useRouter();

  return (
    <LayerCard data-testid="dashboard-all-clear" data-seal-enter>
      <LayerCard.Primary className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle
            className="text-success mt-0.5 size-5 shrink-0"
            weight="fill"
          />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">Nothing blocked</p>
            <p className="text-muted-foreground text-sm">
              No stale signers, deadlines, or bounced emails. Send the next
              document when you&apos;re ready.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0"
          icon={<UploadSimple className="size-4" />}
          onClick={() =>
            void router.navigate({
              to: "/$slug/documents",
              params: { slug },
              search: { folderId: undefined },
            })
          }
        >
          Upload PDF
        </Button>
      </LayerCard.Primary>
    </LayerCard>
  );
}
