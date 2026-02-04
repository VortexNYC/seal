/**
 * JSON-LD Structured Data Components
 *
 * These components inject JSON-LD structured data into the page for
 * improved SEO and GEO (Generative Engine Optimization).
 *
 * Note: dangerouslySetInnerHTML is safe here because:
 * 1. Data comes from our own static configuration functions
 * 2. JSON.stringify() safely escapes all special characters
 * 3. No user input is ever included in the schemas
 */

import {
  generateOrganizationSchema,
  generateProductSchema,
  generateWebSiteSchema,
  type OrganizationSchema,
  type ProductSchema,
  type WebSiteSchema,
} from "@/lib/seo";

interface JsonLdProps<T> {
  data: T;
}

/**
 * Generic JSON-LD script component
 */
function JsonLdScript<T extends object>({ data }: JsonLdProps<T>) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/**
 * Organization JSON-LD - Use on the homepage/landing page
 */
function OrganizationJsonLd() {
  const schema = generateOrganizationSchema();
  return <JsonLdScript<OrganizationSchema> data={schema} />;
}

/**
 * Product/Software Application JSON-LD - Use on the homepage
 */
function ProductJsonLd() {
  const schema = generateProductSchema();
  return <JsonLdScript<ProductSchema> data={schema} />;
}

/**
 * WebSite JSON-LD - Enables Google sitelinks search box
 */
function WebSiteJsonLd() {
  const schema = generateWebSiteSchema();
  return <JsonLdScript<WebSiteSchema> data={schema} />;
}

/**
 * Combined landing page JSON-LD - Organization + Product + WebSite
 * Use this on the homepage for maximum SEO impact
 */
export function LandingPageJsonLd() {
  return (
    <>
      <OrganizationJsonLd />
      <ProductJsonLd />
      <WebSiteJsonLd />
    </>
  );
}
