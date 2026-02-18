import { Link } from "@tanstack/react-router";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center py-8 md:flex-row md:items-center md:justify-between md:py-10">
          {/* Copyright and Legal Links */}
          <div className="mb-6 flex flex-col items-center md:mb-0 md:items-start">
            <div className="text-sm text-muted-foreground">
              {currentYear} Seal. All rights reserved.
            </div>
            <div className="mt-3 flex items-center space-x-6">
              <Link
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
                to="/"
              >
                Terms of Service
              </Link>
              <Link
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
                to="/"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <a
              className="transition-colors hover:text-foreground"
              href="https://seal.co/docs"
            >
              Docs
            </a>
            <Link
              className="transition-colors hover:text-foreground"
              to="/changelog"
            >
              Changelog
            </Link>
            <a
              className="transition-colors hover:text-foreground"
              href="mailto:support@seal.co"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
