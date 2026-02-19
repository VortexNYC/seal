import { sanityServerClient } from "./client";

// ============================================================================
// GROQ Queries
// ============================================================================

const FAQ_QUERY = `*[_type == "faqItem"] | order(_createdAt asc) {
  _id,
  question,
  answer,
  category
}`;

const PRICING_QUERY = `*[_type == "pricingTier"] | order(price asc) {
  _id,
  name,
  description,
  price,
  billingPeriod,
  features,
  highlighted,
  ctaText,
  ctaLink
}`;

const TESTIMONIALS_QUERY = `*[_type == "testimonial"] {
  _id,
  quote,
  author,
  role,
  company,
  avatar {
    asset->{
      _id,
      url,
      metadata {
        lqip,
        dimensions { width, height }
      }
    },
    hotspot,
    crop
  }
}`;

const SITE_SETTINGS_QUERY = `*[_type == "siteSettings"][0] {
  siteName,
  tagline,
  logo {
    asset->{
      _id,
      url
    }
  },
  socialLinks,
  footerText,
  announcement
}`;

const CHANGELOG_LIST_QUERY = `*[_type == "changelog"] | order(releaseDate desc) {
  _id,
  version,
  title,
  releaseDate,
  slug,
  summary,
  coverImage {
    asset->{
      _id,
      url,
      metadata {
        lqip,
        dimensions { width, height }
      }
    },
    alt
  }
}`;

const CHANGELOG_DETAIL_QUERY = `*[_type == "changelog" && slug.current == $slug][0] {
  _id,
  version,
  title,
  releaseDate,
  slug,
  summary,
  coverImage {
    asset->{
      _id,
      url,
      metadata {
        lqip,
        dimensions { width, height }
      }
    },
    alt
  },
  features[] {
    title,
    description,
    image {
      asset->{
        _id,
        url,
        metadata {
          lqip,
          dimensions { width, height }
        }
      },
      alt
    }
  },
  improvements,
  fixes,
  breakingChanges
}`;

const PAGE_QUERY = `*[_type == "page" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  seo,
  content[] {
    _key,
    _type,
    ...,
    _type == "testimonialsSection" => {
      headline,
      testimonials[]->{
        _id,
        quote,
        author,
        role,
        company,
        avatar {
          asset->{
            _id,
            url,
            metadata { lqip }
          }
        }
      }
    },
    _type == "pricingSection" => {
      headline,
      description,
      tiers[]->{
        _id,
        name,
        description,
        price,
        billingPeriod,
        features,
        highlighted,
        ctaText,
        ctaLink
      }
    },
    _type == "faqSection" => {
      headline,
      faqs[]->{
        _id,
        question,
        answer,
        category
      }
    }
  }
}`;

const ALL_PAGE_SLUGS_QUERY = `*[_type == "page" && defined(slug.current)] {
  "slug": slug.current,
  _updatedAt
}`;

// ============================================================================
// Fetch Functions
// ============================================================================

export function getFaqs() {
  return sanityServerClient.fetch<FaqItem[]>(FAQ_QUERY);
}

export function getPricingTiers() {
  return sanityServerClient.fetch<PricingTier[]>(PRICING_QUERY);
}

export function getTestimonials() {
  return sanityServerClient.fetch<Testimonial[]>(TESTIMONIALS_QUERY);
}

export function getSiteSettings() {
  return sanityServerClient.fetch<SiteSettings | null>(SITE_SETTINGS_QUERY);
}

export function getChangelogList() {
  return sanityServerClient.fetch<ChangelogEntry[]>(CHANGELOG_LIST_QUERY);
}

export function getChangelogEntry(slug: string) {
  return sanityServerClient.fetch<ChangelogEntryFull | null>(CHANGELOG_DETAIL_QUERY, { slug });
}

export function getPage(slug: string) {
  return sanityServerClient.fetch<Page | null>(PAGE_QUERY, { slug });
}

export function getAllPageSlugs() {
  return sanityServerClient.fetch<Array<{ slug: string; _updatedAt: string }>>(
    ALL_PAGE_SLUGS_QUERY,
  );
}

// ============================================================================
// Types
// ============================================================================

export interface FaqItem {
  _id: string;
  question: string;
  answer: string;
  category?: "general" | "pricing" | "features" | "technical" | "support";
}

export interface PricingTier {
  _id: string;
  name: string;
  description?: string;
  price: number;
  billingPeriod: "monthly" | "yearly" | "one-time";
  features: string[];
  highlighted: boolean;
  ctaText?: string;
  ctaLink?: string;
}

export interface SanityImage {
  asset: {
    _id: string;
    url: string;
    metadata?: {
      lqip?: string;
      dimensions?: { width: number; height: number };
    };
  };
  hotspot?: { x: number; y: number };
  crop?: { top: number; bottom: number; left: number; right: number };
  alt?: string;
}

export interface Testimonial {
  _id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: SanityImage;
}

export interface SiteSettings {
  siteName: string;
  tagline?: string;
  logo?: SanityImage;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
  footerText?: string;
  announcement?: {
    enabled: boolean;
    text?: string;
    link?: string;
    style?: "info" | "success" | "warning";
  };
}

export interface ChangelogEntry {
  _id: string;
  version: string;
  title: string;
  releaseDate: string;
  slug: { current: string };
  summary?: string;
  coverImage?: SanityImage;
}

export interface ChangelogFeature {
  title: string;
  description?: string;
  image?: SanityImage;
}

export type ChangelogEntryFull = {
  features?: ChangelogFeature[];
  improvements?: string[];
  fixes?: string[];
  breakingChanges?: string[];
} & ChangelogEntry;

// Page Builder Types
export interface HeroBlock {
  _key: string;
  _type: "hero";
  headline: string;
  subheadline?: string;
  image?: SanityImage;
  primaryCta?: { text: string; link: string };
  secondaryCta?: { text: string; link: string };
}

export interface FeatureItem {
  title: string;
  description?: string;
  icon?: string;
}

export interface FeaturesSectionBlock {
  _key: string;
  _type: "featuresSection";
  eyebrow?: string;
  headline?: string;
  description?: string;
  features: FeatureItem[];
  layout?: "grid-3" | "grid-2" | "alternating";
}

export interface TestimonialsSectionBlock {
  _key: string;
  _type: "testimonialsSection";
  headline?: string;
  testimonials: Testimonial[];
}

export interface PricingSectionBlock {
  _key: string;
  _type: "pricingSection";
  headline?: string;
  description?: string;
  tiers: PricingTier[];
}

export interface FaqSectionBlock {
  _key: string;
  _type: "faqSection";
  headline?: string;
  faqs: FaqItem[];
}

export interface CtaSectionBlock {
  _key: string;
  _type: "ctaSection";
  headline: string;
  description?: string;
  primaryCta?: { text: string; link: string };
  secondaryCta?: { text: string; link: string };
  style?: "default" | "gradient" | "dark";
}

export interface LogoCloudBlock {
  _key: string;
  _type: "logoCloud";
  headline?: string;
  logos?: SanityImage[];
}

// Seal-specific blocks
export interface ComparisonTableBlock {
  _key: string;
  _type: "comparisonTable";
  headline?: string;
  description?: string;
  competitors: Array<{
    name: string;
    features: Record<string, boolean | string>;
  }>;
  sealFeatures: Record<string, boolean | string>;
}

export interface TemplatePreviewBlock {
  _key: string;
  _type: "templatePreview";
  headline?: string;
  description?: string;
  templates: Array<{
    name: string;
    description?: string;
    category?: string;
    image?: SanityImage;
  }>;
}

export interface LegalDisclaimerBlock {
  _key: string;
  _type: "legalDisclaimer";
  text: string;
  style?: "info" | "warning";
}

export type PageBlock =
  | HeroBlock
  | FeaturesSectionBlock
  | TestimonialsSectionBlock
  | PricingSectionBlock
  | FaqSectionBlock
  | CtaSectionBlock
  | LogoCloudBlock
  | ComparisonTableBlock
  | TemplatePreviewBlock
  | LegalDisclaimerBlock;

export interface Page {
  _id: string;
  title: string;
  slug: { current: string };
  seo?: {
    title?: string;
    description?: string;
    ogImage?: SanityImage;
  };
  content?: PageBlock[];
}
