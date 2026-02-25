import { defineCliConfig } from "sanity/cli";

import { sanityConfig } from "./src/lib/sanity/env";

export default defineCliConfig({
  api: {
    projectId: sanityConfig.projectId,
    dataset: sanityConfig.dataset,
  },
});
