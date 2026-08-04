/**
 * SEO Configuration and Utilities
 *
 * This module provides centralized SEO configuration and helper functions
 * for generating meta tags, canonical URLs, and structured data.
 */

// Base site configuration
const siteConfig = {
  name: "Seal",
  tagline: "Document Signatures Made Simple",
  description:
    "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
  url: import.meta.env.VITE_APP_URL || "https://app.seal.nyc",
  ogImage: "/favicon/og-image.png",
  twitterHandle: "@sealhq",
  locale: "en_US",
  // vortex-allow-color: Browser theme-color meta requires a concrete color value, not a CSS token.
  themeColor: "#a63d2f",
} as const;

// Route-specific SEO configuration
export interface PageSEO {
  title: string;
  description: string;
  canonical?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
}

// Pre-defined SEO for common pages
export const pageSEO: Record<string, PageSEO> = {
  home: {
    title: "Seal - Document Signatures Made Simple",
    description:
      "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
    ogType: "website",
  },
  signIn: {
    title: "Sign In - Seal",
    description:
      "Sign in to your Seal account to manage your documents and signatures.",
    noIndex: true,
  },
  signUp: {
    title: "Create Your Account - Seal",
    description: "Create your Seal account if you received an invitation.",
    noIndex: true,
  },
  sign: {
    title: "Sign Document - Seal",
    description: "Review and sign your document securely with Seal.",
    noIndex: true,
  },
  dashboard: {
    title: "Dashboard - Seal",
    description:
      "Your Seal dashboard. View recent activity and manage your documents.",
    noIndex: true,
  },
  documents: {
    title: "Documents - Seal",
    description:
      "Manage all your documents in one place. Create, send, and track signatures.",
    noIndex: true,
  },
  templates: {
    title: "Templates - Seal",
    description:
      "Create and manage reusable document templates for faster signing workflows.",
    noIndex: true,
  },
  settings: {
    title: "Settings - Seal",
    description:
      "Manage your account settings, notifications, and preferences.",
    noIndex: true,
  },
  analytics: {
    title: "Analytics - Seal",
    description:
      "View document analytics, signing metrics, and team performance.",
    noIndex: true,
  },
  contacts: {
    title: "Contacts - Seal",
    description: "Manage your contacts and recipients for document signing.",
    noIndex: true,
  },
};

/**
 * Generate canonical URL for a given path
 */
export function getCanonicalUrl(path: string): string {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Create meta tags configuration for TanStack Router head() function
 * Reduces boilerplate when defining route meta tags
 */
export function createPageMeta(
  seo: PageSEO,
  path?: string
): {
  meta: Array<{
    title?: string;
    name?: string;
    property?: string;
    content?: string;
  }>;
  links: Array<{ rel: string; href: string }>;
} {
  const meta: Array<{
    title?: string;
    name?: string;
    property?: string;
    content?: string;
  }> = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
  ];

  if (seo.noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  if (seo.ogType) {
    meta.push({ property: "og:type", content: seo.ogType });
  }

  if (seo.ogImage) {
    meta.push({
      property: "og:image",
      content: `${siteConfig.url}${seo.ogImage}`,
    });
  }

  const links: Array<{ rel: string; href: string }> = [];
  if (path) {
    links.push({ rel: "canonical", href: getCanonicalUrl(path) });
  } else if (seo.canonical) {
    links.push({ rel: "canonical", href: seo.canonical });
  }

  return { meta, links };
}
