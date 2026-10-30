import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { JSX } from "react";

export function RouterDevtools(): JSX.Element {
  return <TanStackRouterDevtools position="bottom-right" />;
}
