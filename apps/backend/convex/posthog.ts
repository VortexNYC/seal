import { PostHog } from "@posthog/convex";
import {
  createVortexPostHogConvexObservability,
  detectRuntimeEnvironment,
  type VortexPostHogAliasArgs,
  type VortexPostHogCaptureArgs,
  type VortexPostHogExceptionArgs,
  type VortexPostHogGroupIdentifyArgs,
  type VortexPostHogIdentifyArgs,
} from "@vortexnyc/observability";

import { components } from "./_generated/api";

const posthog = new PostHog(components.posthog);

type PostHogSchedulerCtx = Parameters<typeof posthog.capture>[0];

export const vortexPostHog = createVortexPostHogConvexObservability(
  {
    capture: async (
      ctx: PostHogSchedulerCtx,
      args: VortexPostHogCaptureArgs
    ) => {
      await posthog.capture(ctx, args);
    },
    identify: async (
      ctx: PostHogSchedulerCtx,
      args: VortexPostHogIdentifyArgs
    ) => {
      await posthog.identify(ctx, args);
    },
    groupIdentify: async (
      ctx: PostHogSchedulerCtx,
      args: VortexPostHogGroupIdentifyArgs
    ) => {
      await posthog.groupIdentify(ctx, args);
    },
    alias: async (ctx: PostHogSchedulerCtx, args: VortexPostHogAliasArgs) => {
      await posthog.alias(ctx, args);
    },
    captureException: async (
      ctx: PostHogSchedulerCtx,
      args: VortexPostHogExceptionArgs
    ) => {
      await posthog.captureException(ctx, {
        distinctId: args.distinctId,
        error: args.error,
        additionalProperties: args.properties,
      });
    },
  },
  {
    service: "seal-backend",
    environment: detectRuntimeEnvironment(process.env.CONVEX_CLOUD_URL),
    deployment: process.env.CONVEX_DEPLOYMENT,
  }
);

export { posthog };
