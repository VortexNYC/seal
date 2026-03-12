import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const productLinks = [
  { label: "AI Review", to: "/#features" },
  { label: "E-Signing", to: "/#features" },
  { label: "Templates", to: "/docs" },
  { label: "Integrations", to: "/integrations" },
];

const companyLinks = [
  { label: "About", href: "https://vortex.nyc" },
  { label: "Pricing", to: "/#pricing" },
  { label: "Blog", to: "/changelog" },
  { label: "Careers", href: "mailto:careers@vortex.nyc" },
];

const legalLinks = [
  { label: "Privacy", to: "/privacy-policy" },
  { label: "Terms", to: "/terms-of-service" },
  { label: "Security", href: "mailto:security@seal.co" },
];

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; to?: string; href?: string }>;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
        {title}
      </p>
      <ul className="space-y-3">
        {links.map((link) =>
          link.to ? (
            <li key={link.label}>
              <Link
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                to={link.to}
              >
                {link.label}
              </Link>
            </li>
          ) : (
            <li key={link.label}>
              <a
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                href={link.href}
              >
                {link.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border border-t px-6 py-16" data-testid="site-footer">
      <div className="mx-auto max-w-6xl">
        {/* Main grid */}
        <div
          className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr]"
          data-testid="site-footer-inner"
        >
          {/* Brand */}
          <div data-testid="site-footer-brand">
            <div className="mb-3 flex items-center gap-2.5">
              <img
                alt=""
                className="size-7 object-contain"
                height={28}
                src="/logo/seal-logo-color-no-background.svg"
                width={28}
              />
              <span className="text-foreground text-lg font-semibold">Seal</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              E-signature with AI that actually reads your contracts.
            </p>
          </div>

          {/* Links */}
          <FooterLinkGroup links={productLinks} title="Product" />
          <FooterLinkGroup links={companyLinks} title="Company" />
          <FooterLinkGroup links={legalLinks} title="Legal" />

          {/* Newsletter */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.12em] uppercase">
              Stay in the loop
            </p>
            <p className="text-muted-foreground mb-4 text-sm">
              Occasional product updates. No fluff.
            </p>
            <form
              className="flex"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input
                aria-label="Email address"
                className="border-border bg-card text-foreground placeholder:text-muted-foreground h-10 flex-1 rounded-l-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)]"
                placeholder="you@company.com"
                type="email"
              />
              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 items-center justify-center rounded-r-lg px-3 transition-colors"
                type="submit"
              >
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-border mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <span className="text-muted-foreground text-sm">
            © {currentYear} Seal. All rights reserved.
          </span>
          <div className="flex items-center gap-2" data-testid="site-footer-links">
            <img
              alt=""
              className="size-4 object-contain opacity-50"
              height={16}
              src="/logo/seal-logo-color-no-background.svg"
              width={16}
            />
            <span className="text-muted-foreground text-sm">
              A{" "}
              <a
                className="text-primary hover:underline"
                href="https://vortex.nyc"
                rel="noopener noreferrer"
                target="_blank"
              >
                Vortex
              </a>{" "}
              company
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
