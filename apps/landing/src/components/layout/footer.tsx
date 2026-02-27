import { Link } from "@tanstack/react-router";

const footerLinks = [
  { label: "Docs", to: "/docs", external: false },
  { label: "API", to: "/docs/api-reference", external: false },
  { label: "Changelog", to: "/changelog", external: false },
  { label: "Support", href: "mailto:support@seal.co", external: true },
  { label: "Terms", to: "/terms-of-service", external: false },
  { label: "Privacy", to: "/privacy-policy", external: false },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border border-t px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        {/* Logo + copyright */}
        <div className="flex items-center gap-2.5">
          <img
            alt=""
            className="size-6 object-contain"
            height={24}
            src="/logo/seal-logo-color-no-background.svg"
            width={24}
          />
          <span className="text-muted-foreground text-sm">{currentYear} Seal</span>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) =>
            link.external ? (
              <a
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </a>
            ) : (
              <Link
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                key={link.label}
                to={link.to!}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
