import type { SanityImageSource } from "@sanity/image-url";
import imageUrlBuilder from "@sanity/image-url";

import { sanityConfig } from "./env";

const builder = imageUrlBuilder({
  projectId: sanityConfig.projectId,
  dataset: sanityConfig.dataset,
});

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
