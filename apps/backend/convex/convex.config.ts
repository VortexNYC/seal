import actionCache from "@convex-dev/action-cache/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(agent);
app.use(rateLimiter);
app.use(actionCache);
app.use(actionRetrier);
app.use(rag);
app.use(aggregate, { name: "aiUsageAggregate" });
app.use(workpool, { name: "aiPoolPro" });
app.use(workpool, { name: "aiPoolFree" });

export default app;
