/**
 * Circular progress ring showing document signing progress.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Text } from "@cloudflare/kumo/components/text";

interface ProgressData {
  percentComplete: number;
  byStatus: {
    signed: number;
    pending: number;
    viewed: number;
    declined: number;
  };
}

interface DocumentProgressRingProps {
  progress: ProgressData;
}

const PROGRESS_STATS = [
  { key: "signed", label: "Signed" },
  { key: "pending", label: "Pending" },
  { key: "viewed", label: "Viewed" },
] as const;

/** Counts shown under the meter. Declined appears only after someone declines. */
export function progressStats(progress: ProgressData): Array<{
  label: string;
  value: number;
  colorClass: string;
}> {
  const stats: Array<{ label: string; value: number; colorClass: string }> =
    PROGRESS_STATS.map((stat) => ({
      label: stat.label,
      value: progress.byStatus[stat.key],
      colorClass: "text-kumo-default",
    }));
  if (progress.byStatus.declined > 0) {
    stats.push({
      label: "Declined",
      value: progress.byStatus.declined,
      colorClass: "text-kumo-danger",
    });
  }
  return stats;
}

/** Four counts sit in two full rows. Three sit on one row, so none is left alone. */
export function progressStatColumns(count: number): 2 | 3 {
  return count === 4 ? 2 : 3;
}

export function DocumentProgressRing({ progress }: DocumentProgressRingProps) {
  const stats = progressStats(progress);
  const columns = progressStatColumns(stats.length);
  return (
    <LayerCard className="flex shrink-0 flex-col gap-4 p-6 sm:p-4">
      <Meter
        label="Signing progress"
        value={progress.percentComplete}
        customValue={`${progress.percentComplete}% complete`}
      />

      <div
        className={
          columns === 2
            ? "grid w-full grid-cols-2 gap-2"
            : "grid w-full grid-cols-3 gap-2"
        }
      >
        {stats.map((stat) => (
          <StatusBox
            key={stat.label}
            value={stat.value}
            label={stat.label}
            colorClass={stat.colorClass}
          />
        ))}
      </div>
    </LayerCard>
  );
}

interface StatusBoxProps {
  value: number;
  label: string;
  colorClass: string;
}

function StatusBox({ value, label, colorClass }: StatusBoxProps) {
  return (
    <div className="px-2 py-3 text-center sm:px-1.5 sm:py-2.5">
      <Text size="lg" DANGEROUS_className={colorClass}>
        {value}
      </Text>
      <Text variant="secondary" size="xs">
        {label}
      </Text>
    </div>
  );
}
