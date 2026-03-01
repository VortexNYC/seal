import { Timeline } from "convex-timeline";

import { components } from "./_generated/api";

export const timeline = new Timeline(components.timeline, {
  maxNodesPerScope: 50,
});
