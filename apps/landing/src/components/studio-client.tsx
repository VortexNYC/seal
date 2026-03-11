import { Studio } from "sanity";
import type { ReactElement } from "react";

import studioConfig from "../../sanity.config";

export function StudioClient(): ReactElement {
  return <Studio config={studioConfig} />;
}
