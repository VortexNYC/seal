import { defineCliConfig } from "sanity/cli";

import { dataset, projectId } from "@seal/sanity-config";

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
