import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const betterAuthBaseUrlValue = import.meta.env.VITE_BETTER_AUTH_URL;
const betterAuthBaseUrl =
  typeof betterAuthBaseUrlValue === "string" ? betterAuthBaseUrlValue : "";

export const betterAuthClient =
  betterAuthBaseUrl.length > 0
    ? createAuthClient({
        baseURL: betterAuthBaseUrl,
        fetchOptions: {
          credentials: "include",
        },
        plugins: [organizationClient()],
      })
    : null;
