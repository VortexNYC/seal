import type { PageBlock } from "~/lib/sanity/queries";
import {
  ComparisonTableBlockComponent,
  CtaBlockComponent,
  FaqBlockComponent,
  FeaturesBlockComponent,
  HeroBlockComponent,
  LegalDisclaimerBlockComponent,
  LogoCloudBlockComponent,
  PricingBlockComponent,
  TemplatePreviewBlockComponent,
  TestimonialsBlockComponent,
} from "./sections";

/**
 * PageBuilder renders Sanity page content blocks.
 * Each block `_type` maps to a React component.
 * This is the core of the programmatic SEO system — new pages
 * created in Sanity automatically render here without code changes.
 */
export function PageBuilder({ content }: { content: PageBlock[] }) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <>
      {content.map((block) => {
        switch (block._type) {
          case "hero":
            return <HeroBlockComponent block={block} key={block._key} />;
          case "featuresSection":
            return <FeaturesBlockComponent block={block} key={block._key} />;
          case "testimonialsSection":
            return <TestimonialsBlockComponent block={block} key={block._key} />;
          case "pricingSection":
            return <PricingBlockComponent block={block} key={block._key} />;
          case "faqSection":
            return <FaqBlockComponent block={block} key={block._key} />;
          case "ctaSection":
            return <CtaBlockComponent block={block} key={block._key} />;
          case "logoCloud":
            return <LogoCloudBlockComponent block={block} key={block._key} />;
          case "comparisonTable":
            return <ComparisonTableBlockComponent block={block} key={block._key} />;
          case "templatePreview":
            return <TemplatePreviewBlockComponent block={block} key={block._key} />;
          case "legalDisclaimer":
            return <LegalDisclaimerBlockComponent block={block} key={block._key} />;
          default:
            return null;
        }
      })}
    </>
  );
}
