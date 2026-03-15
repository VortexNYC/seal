import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { APP_URL } from "~/lib/constants";
import { cn } from "~/utils/cn";

const navItems = [
  { label: "Pricing", href: "/", hash: "pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const [isScrolled, setIsScrolled] = useState(false);
  const hasClerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-200",
        isScrolled
          ? "bg-background/90 border-border border-b backdrop-blur-lg"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link aria-label="Seal homepage" className="flex items-center gap-2.5" to="/">
          <img
            alt=""
            className="size-8 object-contain"
            height={32}
            src="/logo/seal-logo-color-no-background.svg"
            width={32}
          />
          <span className="text-foreground text-lg font-semibold">Seal</span>
        </Link>

        {/* Desktop nav */}
        <nav className="flex items-center gap-1 max-md:hidden" data-testid="desktop-nav">
          {navItems.map((item) => (
            <Link
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href && !item.hash && "text-foreground",
              )}
              hash={item.hash}
              key={item.label}
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="flex items-center gap-3 max-md:hidden">
          {hasClerk ? (
            <>
              <SignedOut>
                <SignedOutDesktopCtas />
              </SignedOut>
              <SignedIn>
                <SignedInCta />
              </SignedIn>
            </>
          ) : (
            <SignedOutDesktopCtas />
          )}
        </div>

        {/* Mobile toggle */}
        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="text-foreground flex size-11 items-center justify-center rounded-md md:hidden"
          data-testid="mobile-menu-button"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="bg-background border-border border-t px-6 pt-4 pb-6 md:hidden" data-testid="mobile-nav">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                className="text-foreground hover:text-primary rounded-md px-3 py-2.5 text-base font-medium transition-colors"
                hash={item.hash}
                key={item.label}
                onClick={() => setMobileOpen(false)}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            {hasClerk ? (
              <>
                <SignedOut>
                  <SignedOutMobileCtas />
                </SignedOut>
                <SignedIn>
                  <SignedInMobileCta />
                </SignedIn>
              </>
            ) : (
              <SignedOutMobileCtas />
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function SignedOutDesktopCtas() {
  return (
    <>
      <Button asChild className="text-muted-foreground hover:text-foreground" variant="ghost">
        <a href={`${APP_URL}/sign-in`}>Sign in</a>
      </Button>
      <Button asChild className="group">
        <a href={`${APP_URL}/sign-up`}>
          Start Free
          <ArrowRight
            aria-hidden="true"
            className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </a>
      </Button>
    </>
  );
}

function SignedOutMobileCtas() {
  return (
    <>
      <Button asChild variant="outline" size="lg" className="w-full">
        <a href={`${APP_URL}/sign-in`}>Sign in</a>
      </Button>
      <Button asChild className="group w-full" size="lg">
        <a href={`${APP_URL}/sign-up`}>
          Start Free
          <ArrowRight
            aria-hidden="true"
            className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </a>
      </Button>
    </>
  );
}

function SignedInCta() {
  return (
    <Button asChild className="group">
      <a href={`${APP_URL}/app`}>
        Open App
        <ArrowRight
          aria-hidden="true"
          className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
        />
      </a>
    </Button>
  );
}

function SignedInMobileCta() {
  return (
    <Button asChild className="group w-full" size="lg">
      <a href={`${APP_URL}/app`}>
        Open App
        <ArrowRight
          aria-hidden="true"
          className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
        />
      </a>
    </Button>
  );
}
