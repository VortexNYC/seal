/**
 * Shown when Needs Attention is empty — still answers “what needs me?”
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { CheckCircle, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";

interface AllClearProps {
  slug: string;
}

export function AllClear({ slug }: AllClearProps): ReactElement {
  const router = useRouter();

  return (
    <LayerCard
      data-testid="dashboard-all-clear"
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <CheckCircle
          className="text-kumo-success mt-0.5 size-5 shrink-0"
          weight="fill"
        />
        <div className="flex flex-col gap-0.5">
          <Text size="sm">Nothing blocked</Text>
          <Text variant="secondary" size="sm">
            No stale signers, deadlines, or bounced emails. Send the next
            document when you&apos;re ready.
          </Text>
        </div>
      </div>
      <Button
        type="button"
        variant="primary"
        className="shrink-0"
        icon={UploadSimple}
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
    </LayerCard>
  );
}
