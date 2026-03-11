export interface ContentImage {
  alt?: string;
  height?: number;
  src: string;
  width?: number;
}

export interface FaqItem {
  answer: string;
  category?: "general" | "pricing" | "features" | "technical" | "support";
  id: string;
  question: string;
}

export interface PricingTier {
  billingPeriod: "monthly" | "yearly" | "one-time";
  ctaLink?: string;
  ctaText?: string;
  description?: string;
  features: string[];
  highlighted: boolean;
  id: string;
  name: string;
  price: number;
}

export interface Testimonial {
  author: string;
  avatar?: ContentImage;
  company?: string;
  id: string;
  quote: string;
  role?: string;
}

export interface HeroBlock {
  _key: string;
  _type: "hero";
  headline: string;
  image?: ContentImage;
  primaryCta?: { text: string; link: string };
  secondaryCta?: { text: string; link: string };
  subheadline?: string;
}

export interface FeatureItem {
  description?: string;
  icon?: string;
  title: string;
}

export interface FeaturesSectionBlock {
  _key: string;
  _type: "featuresSection";
  description?: string;
  eyebrow?: string;
  features: FeatureItem[];
  headline?: string;
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
  description?: string;
  headline?: string;
  tiers: PricingTier[];
}

export interface FaqSectionBlock {
  _key: string;
  _type: "faqSection";
  faqs: FaqItem[];
  headline?: string;
}

export interface CtaSectionBlock {
  _key: string;
  _type: "ctaSection";
  description?: string;
  headline: string;
  primaryCta?: { text: string; link: string };
  secondaryCta?: { text: string; link: string };
  style?: "default" | "gradient" | "dark";
}

export interface LogoCloudBlock {
  _key: string;
  _type: "logoCloud";
  headline?: string;
  logos?: ContentImage[];
}

export interface ComparisonTableBlock {
  _key: string;
  _type: "comparisonTable";
  competitors: Array<{
    features: Record<string, boolean | string>;
    name: string;
  }>;
  description?: string;
  headline?: string;
  sealFeatures: Record<string, boolean | string>;
}

export interface TemplatePreviewBlock {
  _key: string;
  _type: "templatePreview";
  description?: string;
  headline?: string;
  templates: Array<{
    category?: string;
    description?: string;
    image?: ContentImage;
    name: string;
  }>;
}

export interface LegalDisclaimerBlock {
  _key: string;
  _type: "legalDisclaimer";
  style?: "info" | "warning";
  text: string;
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

export interface PageSeo {
  description?: string;
  ogImage?: ContentImage;
  title?: string;
}

export interface LandingPage {
  content: PageBlock[];
  id: string;
  seo?: PageSeo;
  slug: string;
  title: string;
  updatedAt?: string;
}
