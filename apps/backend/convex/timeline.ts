import { Timeline } from "convex-timeline";

import { components } from "./_generated/api";
import { formatDurationMs } from "./lib/timeFormat";

export const timeline = new Timeline(components.timeline, {
  maxNodesPerScope: 50,
});

export function formatTimelineMaxAge(ms: number): string {
  return formatDurationMs(ms);
}
