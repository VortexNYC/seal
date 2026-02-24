import { Link } from "@tanstack/react-router";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-background border-t">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center py-8 md:flex-row md:items-center md:justify-between md:py-10">
          {/* Copyright and Legal Links */}
          <div className="mb-6 flex flex-col items-center md:mb-0 md:items-start">
            <div className="text-muted-foreground text-sm">
              {currentYear} Seal. All rights reserved.
            </div>
            <div className="mt-3 flex items-center space-x-6">
              <Link
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
                to="/"
              >
                Terms of Service
              </Link>
              <Link
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
                to="/"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Links */}
          <div className="text-muted-foreground flex items-center space-x-6 text-sm">
            <Link className="hover:text-foreground transition-colors" to="/docs">
              Docs
            </Link>
            <Link className="hover:text-foreground transition-colors" to="/changelog">
              Changelog
            </Link>
            <a className="hover:text-foreground transition-colors" href="mailto:support@seal.co">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
