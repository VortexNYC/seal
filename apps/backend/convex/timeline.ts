/**
 * Timeline component for real-time document activity tracking.
 * Tracks up to 50 nodes per scope for collaborative editing.
 */
import { Timeline } from "convex-timeline";

import { components } from "./_generated/api";

export const timeline = new Timeline(components.timeline, {
  maxNodesPerScope: 50,
});
