import fs from "node:fs";
import path from "node:path";

import { workspaceSlugPath } from "./paths";

const RESERVED_ORG_SLUGS = new Set([
  "app",
  "onboarding",
  "sign-in",
  "sign-up",
  "accept-invite",
  "verify-email",
  "forgot-password",
  "reset-password",
]);

export function extractOrganizationSlugFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(
      /^\/([\w-]+)\/(?:home|documents|settings|templates|analytics)(?:\/|$)/
    );
    const slug = match?.[1] ?? null;
    if (!slug || RESERVED_ORG_SLUGS.has(slug)) {
      return null;
    }
    return slug;
  } catch {
    return null;
  }
}

export function readCachedWorkspaceSlug(): string | null {
  try {
    const slug = fs.readFileSync(workspaceSlugPath, "utf8").trim();
    return slug.length > 0 ? slug : null;
  } catch {
    return null;
  }
}

export function writeCachedWorkspaceSlug(slug: string): void {
  fs.mkdirSync(path.dirname(workspaceSlugPath), { recursive: true });
  fs.writeFileSync(workspaceSlugPath, slug, "utf8");
}
