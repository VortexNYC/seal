import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Menu } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { cn } from "~/utils/cn";

const navItems = [
  { label: "Pricing", href: "/", hash: "pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
];

// The web app URL for auth routes
const APP_URL = "https://app.seal.co";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur transition-colors",
        isScrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link aria-label="Seal homepage" className="flex items-center gap-2" to="/">
          <div className="flex size-8 items-center justify-center rounded-lg bg-teal-600">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="text-lg font-bold text-white">Seal</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors",
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
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost">
            <a href={`${APP_URL}/sign-in`}>Sign In</a>
          </Button>
          <Button asChild className="group">
            <a href={`${APP_URL}/sign-up`}>
              Get Started
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet onOpenChange={setIsOpen} open={isOpen}>
            <SheetTrigger asChild>
              <Button aria-label="Open menu" className="size-11" size="icon" variant="ghost">
                <Menu aria-hidden="true" className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-xs" side="right">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Main navigation links and actions
              </SheetDescription>
              <nav className="mt-8 flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    className="hover:text-primary py-2 text-lg font-medium transition-colors"
                    hash={item.hash}
                    key={item.label}
                    onClick={() => setIsOpen(false)}
                    to={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-4 border-t" />
                <Button asChild variant="outline" size="lg" className="w-full">
                  <a href={`${APP_URL}/sign-in`} onClick={() => setIsOpen(false)}>
                    Sign In
                  </a>
                </Button>
                <Button asChild className="group w-full" size="lg">
                  <a href={`${APP_URL}/sign-up`} onClick={() => setIsOpen(false)}>
                    Get Started
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
