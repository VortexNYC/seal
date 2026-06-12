import { createVortexHostedLink } from "./hostedLink";
import type {
  VortexHostedSurfaceRequest,
  VortexSurfaceLaunch,
  VortexSurfaceProviderConfig,
} from "./types";

export type VortexSurfaceProviderRuntime = {
  readonly config: VortexSurfaceProviderConfig;
  readonly createHostedLink: (request: VortexHostedSurfaceRequest) => VortexSurfaceLaunch;
};

export function createVortexSurfaceProvider(
  config: VortexSurfaceProviderConfig,
): VortexSurfaceProviderRuntime {
  return {
    config,
    createHostedLink: (request) => createVortexHostedLink(config, request),
  };
}
