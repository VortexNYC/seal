import actionCache from "@convex-dev/action-cache/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import agent from "@convex-dev/agent/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import rag from "@convex-dev/rag/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import vortexAuth from "@vortexnyc/auth/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(agent);
app.use(rateLimiter);
app.use(betterAuth);
app.use(vortexAuth);
app.use(actionCache);
app.use(actionRetrier);
app.use(rag);
app.use(migrations);
app.use(aggregate, { name: "aiUsageAggregate" });
app.use(workflow);
app.use(workpool, { name: "aiPoolPro" });
app.use(workpool, { name: "aiPoolFree" });

export default app;
