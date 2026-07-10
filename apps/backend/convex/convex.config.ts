import actionCache from "@convex-dev/action-cache/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import agent from "@convex-dev/agent/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import presence from "@convex-dev/presence/convex.config";
import rag from "@convex-dev/rag/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import vortexAuth from "@vortexnyc/auth/convex.config.js";
import posthog from "@posthog/convex/convex.config.js";
import timeline from "convex-timeline/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    POSTHOG_PROJECT_TOKEN: v.string(),
    POSTHOG_HOST: v.optional(v.string()),
    POSTHOG_PERSONAL_API_KEY: v.optional(v.string()),
    POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS: v.optional(v.string()),
  },
});
app.use(agent);
app.use(rateLimiter);
app.use(betterAuth);
app.use(vortexAuth);
app.use(posthog, {
  env: {
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
    POSTHOG_HOST: app.env.POSTHOG_HOST,
    POSTHOG_PERSONAL_API_KEY: app.env.POSTHOG_PERSONAL_API_KEY,
    POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS: app.env.POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS,
  },
});
app.use(actionCache);
app.use(actionRetrier);
app.use(rag);
app.use(migrations);
app.use(aggregate, { name: "aiUsageAggregate" });
app.use(presence);
app.use(workflow);
app.use(timeline);
app.use(workpool, { name: "aiPoolPro" });
app.use(workpool, { name: "aiPoolFree" });

export default app;
