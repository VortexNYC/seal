const rawAppUrl: unknown = import.meta.env.VITE_APP_URL;

export const APP_URL =
  typeof rawAppUrl === "string" && rawAppUrl.length > 0
    ? rawAppUrl
    : "https://app.seal.nyc";
