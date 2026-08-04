/**
 * SEO Configuration and Utilities for the Landing App
 *
 * Adapted from apps/web/src/lib/seo.ts for server-side rendering.
 * Uses hardcoded URL (no import.meta.env) since this runs on the server.
 */

const SITE_URL = "https://seal.co";

const siteConfig = {
  name: "Seal",
  tagline: "Document Signatures Made Simple",
  description:
    "Sign, send, and manage documents securely. ESIGN compliant digital signatures with audit trails. Free to start. No credit card required.",
  url: SITE_URL,
  ogImage: `${SITE_URL}/favicon/og-image.png`,
  twitterHandle: "@sealhq",
  locale: "en_US",
  // vortex-allow-color: Browser theme-color meta requires a concrete color value, not a CSS token.
  themeColor: "#a63d2f",
} as const;

export { siteConfig };

export interface PageSEO {
  title: string;
  description: string;
  canonical?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
}

/**
 * Generate canonical URL for a given path
 */
export function getCanonicalUrl(path: string): string {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Create meta tags for TanStack Router head() function
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
    { property: "og:type", content: seo.ogType || "website" },
    {
      property: "og:url",
      content: path ? getCanonicalUrl(path) : siteConfig.url,
    },
    {
      property: "og:image",
      content: seo.ogImage || siteConfig.ogImage,
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: seo.title },
    { name: "twitter:description", content: seo.description },
    {
      name: "twitter:image",
      content: seo.ogImage || siteConfig.ogImage,
    },
  ];

  if (seo.noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  const links: Array<{ rel: string; href: string }> = [];
  if (path) {
    links.push({ rel: "canonical", href: getCanonicalUrl(path) });
  } else if (seo.canonical) {
    links.push({ rel: "canonical", href: seo.canonical });
  }

  return { meta, links };
}

/**
 * Generate Organization JSON-LD schema
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: siteConfig.ogImage,
    description: siteConfig.description,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@seal.co",
    },
  };
}

/**
 * Generate SoftwareApplication JSON-LD schema
 */
export function generateProductSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Seal - Document Signatures",
    description: siteConfig.description,
    url: siteConfig.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

/**
 * Generate WebSite JSON-LD schema
 */
export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

/**
 * Generate FAQ JSON-LD schema from an array of Q&A pairs
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
