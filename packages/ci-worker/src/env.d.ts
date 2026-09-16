import type { CiBindings } from "@cloudflare/ci/worker";

declare global {
  interface Env extends CiBindings {}
}

export {};
