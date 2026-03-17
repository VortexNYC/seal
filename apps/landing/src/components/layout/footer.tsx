import { Link } from "@tanstack/react-router";

const productLinks = [
  { label: "AI Review", to: "/#features" },
  { label: "E-Signing", to: "/#features" },
  { label: "Templates", to: "/docs" },
  { label: "Integrations", to: "/integrations" },
];

const companyLinks = [
  { label: "Pricing", to: "/#pricing" },
  { label: "Changelog", to: "/changelog" },
  { label: "Support", href: "mailto:support@seal.co" },
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
          className="grid gap-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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
        </div>

        {/* Bottom bar */}
        <div className="border-border mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <span className="text-muted-foreground text-sm">
            © {currentYear} Seal. All rights reserved.
          </span>
          <nav className="flex items-center gap-x-6 gap-y-2" data-testid="site-footer-links">
            <a
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              href="mailto:support@seal.co"
            >
              Support
            </a>
            <a
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              href="https://status.seal.co"
            >
              Status
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
