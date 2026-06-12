import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { APP_URL } from "~/lib/constants";
import { cn } from "~/utils/cn";

const navItems = [
  { label: "Compare", href: "/compare" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Developer", href: "/developer" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const [isScrolled, setIsScrolled] = useState(false);

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
        <Link aria-label="Seal homepage" className="flex items-center gap-1.5" to="/">
          <svg
            aria-hidden="true"
            fill="none"
            height={36}
            viewBox="0 0 120 120"
            width={36}
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(18, 15) scale(0.95)">
              <path
                d="M88.648,6.374c0.001-0.055-0.013-0.108-0.022-0.163c-0.011-0.07-0.021-0.138-0.048-0.204c-0.006-0.014-0.004-0.029-0.01-0.043C88.551,5.927,88.52,5.903,88.5,5.869c-0.037-0.061-0.073-0.119-0.124-0.17c-0.047-0.048-0.1-0.082-0.155-0.119c-0.035-0.023-0.06-0.057-0.099-0.076c-0.014-0.007-0.03-0.005-0.045-0.012c-0.067-0.029-0.137-0.042-0.21-0.055c-0.051-0.009-0.1-0.024-0.15-0.025c-0.063-0.001-0.123,0.014-0.186,0.025c-0.063,0.011-0.124,0.02-0.183,0.044c-0.015,0.006-0.031,0.004-0.047,0.011c-0.056,0.024-5.57,2.547-7.997,3.334c-22.236,7.188-30.275,14.612-33.171,18.833c-0.095-0.22-0.273-0.402-0.501-0.501c-0.331-0.138-0.716-0.084-0.99,0.146c-4.199,3.507-6.103,9.171-6.938,12.867l-0.79-2.153c-0.112-0.301-0.366-0.527-0.68-0.6c-0.314-0.078-0.639,0.015-0.875,0.234c-1.966,1.852-8.369,13.68-10.522,17.71l-1.207-1.291c-0.348-0.377-0.936-0.407-1.321-0.075c-0.224,0.193-5.462,4.77-5.424,11.972c0.036,6.717-0.428,12.574-0.432,12.632c0,0.001,0,0.002,0,0.003c-0.01,0.126,0.004,0.253,0.044,0.374c0.018,0.054,0.055,0.097,0.082,0.146c-3.129,4.488-6.352,9.261-9.679,14.39c-0.286,0.445-0.161,1.037,0.282,1.325c0.161,0.103,0.342,0.153,0.521,0.153c0.312,0,0.62-0.153,0.803-0.435c3.72-5.735,7.323-11.05,10.802-15.986c2.853-1.439,7.119-1.248,10.079-1.111c1.166,0.056,2.085,0.101,2.751,0.039c0.534-0.049,1.532-0.136,1.723-1.016c0.153-0.702-0.34-1.13-0.94-1.5c0.11,0.015,0.217,0.028,0.318,0.041c1.857,0.245,3.136,0.377,3.954,0.071c0.762-0.29,0.826-0.901,0.828-1.08c0.009-0.968-0.96-1.357-3.085-2.205c-0.262-0.105-0.585-0.235-0.923-0.374c0.392,0.007,0.792,0.021,1.166,0.032c3.111,0.095,6.988,0.215,9.111-0.723c0.45-0.198,1.65-0.729,1.626-1.796c-0.028-1.125-1.31-1.618-2.667-2.139c-0.241-0.093-0.557-0.215-0.845-0.338c0.617-0.278,1.495-0.628,2.356-0.972c4.754-1.893,13.605-5.417,20.035-12.174c2.893-3.038,3.763-4.677,3.107-5.845c-0.783-1.398-3.074-0.904-5.727-0.329c-0.499,0.107-1.151,0.249-1.756,0.355c0.63-0.207,1.358-0.413,1.979-0.589c3.285-0.929,7.784-2.201,9.674-5.254c2.964-4.785,6.675-10.505,6.71-10.561c0.2-0.306,0.207-0.701,0.019-1.015c-0.189-0.314-0.555-0.488-0.904-0.46c-0.82,0.073-1.676,0.142-2.472,0.204c2.08-1.317,4.559-3.01,5.594-4.344c0.929-1.196,1.809-3.737,3.027-7.257c1.181-3.414,2.651-7.665,4.511-11.445c0.007-0.015,0.006-0.03,0.012-0.045c0.027-0.062,0.038-0.127,0.051-0.194C88.632,6.486,88.648,6.431,88.648,6.374zM82.237,17.604c-1.071,3.093-1.996,5.763-2.728,6.708c-1.172,1.51-5.251,4.002-6.99,5.066c-1.274,0.779-1.351,0.826-1.495,1.103c-0.164,0.31-0.148,0.695,0.047,0.988c0.336,0.506,0.406,0.622,5.047,0.232c-1.327,2.061-3.668,5.72-5.671,8.954c-1.501,2.422-5.585,3.576-8.569,4.421c-2.446,0.691-4.062,1.149-4.612,2.179c-0.204,0.385-0.241,0.809-0.105,1.226c0.519,1.601,2.683,1.13,5.421,0.538c1.101-0.235,2.863-0.604,3.562-0.532c-0.142,0.383-0.682,1.364-2.734,3.518c-6.14,6.454-14.737,9.877-19.357,11.716c-3.223,1.284-4.311,1.717-4.171,2.842c0.131,1.048,1.312,1.504,2.679,2.029c0.277,0.106,0.656,0.252,0.972,0.394c-0.006,0.002-0.011,0.004-0.017,0.007c-1.725,0.761-5.51,0.643-8.28,0.561c-3.427-0.108-4.43-0.099-4.89,0.699c-0.177,0.305-0.153,0.867,0.032,1.166c0.368,0.598,1.224,1.069,2.551,1.635c-1.721-0.219-2.715-0.278-3.24,0.396c-0.262,0.334-0.316,0.768-0.149,1.185c0.146,0.37,0.419,0.678,0.749,0.949c-0.256-0.011-0.529-0.024-0.809-0.037c-2.357-0.11-5.469-0.255-8.27,0.357c31.813-44.445,52.595-56.176,52.827-56.302c0.463-0.254,0.635-0.835,0.381-1.299c-0.252-0.46-0.828-0.637-1.297-0.383c-0.973,0.53-21.969,12.335-54.607,58.446c0.135-2.361,0.304-6.217,0.282-10.409c-0.026-4.86,2.797-8.455,4.105-9.86l1.45,1.551c0.209,0.226,0.516,0.334,0.824,0.297c0.308-0.041,0.576-0.228,0.721-0.503c2.964-5.602,7.551-13.896,9.806-17.167l1.446,3.935c0.155,0.419,0.564,0.673,1.026,0.618c0.443-0.06,0.787-0.418,0.826-0.865c0.007-0.094,0.807-8.567,5.434-13.794l0.075,1.155c0.032,0.488,0.426,0.865,0.914,0.888c0.548-0.023,0.916-0.336,0.988-0.819c0.017-0.105,1.97-10.563,33.479-20.749c1.506-0.487,4.031-1.561,5.886-2.377C84.368,11.49,83.202,14.817,82.237,17.604z"
                fill="#A63D2F"
              />
            </g>
          </svg>
          <span className="text-foreground font-serif text-[28px] leading-none tracking-tight italic">
            Seal
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="flex items-center gap-1 max-md:hidden" data-testid="desktop-nav">
          {navItems.map((item) => (
            <Link
              className={cn(
                "text-foreground/70 hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href && "text-foreground",
              )}
              key={item.label}
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="flex items-center gap-2 max-md:hidden">
          <ThemeToggle />
          <SignedOutDesktopCtas />
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
        <nav
          className="bg-background border-border border-t px-6 pt-4 pb-6 md:hidden"
          data-testid="mobile-nav"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                className="text-foreground hover:text-primary rounded-md px-3 py-2.5 text-base font-medium transition-colors"
                key={item.label}
                onClick={() => setMobileOpen(false)}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            <SignedOutMobileCtas />
          </div>
        </nav>
      )}
    </header>
  );
}

function SignedOutDesktopCtas() {
  return (
    <>
      <Button
        asChild
        className="border-primary text-foreground hover:text-foreground"
        variant="outline"
      >
        <a href={`${APP_URL}/sign-in`}>Sign in</a>
      </Button>
      <Button asChild className="group text-foreground">
        <a href={`${APP_URL}/waitlist`}>
          Join Waitlist
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
        <a href={`${APP_URL}/waitlist`}>
          Join Waitlist
          <ArrowRight
            aria-hidden="true"
            className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </a>
      </Button>
    </>
  );
}
