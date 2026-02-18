import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, CheckCircle2, Code2, FileText, Shield, Users, X } from "lucide-react";

import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
import { LandingPageJsonLd } from "@/components/seo";
import { BackgroundPattern } from "@/components/ui/background-pattern";
import { Button } from "@/components/ui/button";
import { GridLayout } from "@/components/ui/patterns";
import { useAnalytics } from "@/hooks/use-analytics";
import { getCanonicalUrl, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: pageSEO.home.title },
      { name: "description", content: pageSEO.home.description },
      { property: "og:title", content: pageSEO.home.title },
      { property: "og:description", content: pageSEO.home.description },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: getCanonicalUrl("/") }],
  }),
});

function HomePage() {
  const { capture } = useAnalytics();

  return (
    <GridLayout className="from-brand-50 dark:via-background dark:to-background bg-linear-to-b via-white to-white dark:from-slate-950">
      <LandingPageJsonLd />
      <BackgroundPattern className="bg-transparent" opacity={0.04} />

      <div className="flex min-h-screen flex-col">
        <header className="border-brand-700/10 dark:bg-background/70 relative z-10 border-b bg-white/70 backdrop-blur-sm dark:border-slate-800">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <Link to="/" className="transition-transform duration-300 hover:scale-105">
              <SealLogoBadgeFixed size={48} withText />
            </Link>
            <nav className="flex items-center gap-3">
              <a
                href="#pricing"
                className="hover:text-brand-700 dark:hover:text-brand-400 text-sm font-medium text-gray-600 transition-colors dark:text-gray-300"
              >
                Pricing
              </a>
              <a
                href="https://seal.co/docs"
                className="hover:text-brand-700 dark:hover:text-brand-400 text-sm font-medium text-gray-600 transition-colors dark:text-gray-300"
              >
                Docs
              </a>
              <SignedIn>
                <Button
                  asChild
                  className="bg-brand-700 hover:bg-brand-800 shadow-brand-700/20 hover:shadow-brand-700/30 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "go_to_app",
                      location: "header",
                    })
                  }
                >
                  <Link to="/app" className="flex items-center gap-2">
                    Go to App
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
              <SignedOut>
                <Button
                  variant="ghost"
                  asChild
                  className="text-brand-700 hover:text-brand-800 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "sign_in",
                      location: "header",
                    })
                  }
                >
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button
                  asChild
                  className="bg-brand-700 hover:bg-brand-800 shadow-brand-700/20 hover:shadow-brand-700/30 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "get_started",
                      location: "header",
                    })
                  }
                >
                  <Link to="/sign-up">Get Started</Link>
                </Button>
              </SignedOut>
            </nav>
          </div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20">
          <article className="mx-auto max-w-4xl text-center">
            <div className="mb-8 animate-[fadeIn_0.6s_ease-out]" aria-hidden="true">
              <SealLogoBadgeFixed size={120} withText />
            </div>

            <h1 className="mb-6 animate-[fadeIn_0.6s_ease-out_0.1s_both] text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl dark:text-white">
              Document signatures
              <br />
              <span className="text-brand-700 dark:text-brand-400">made simple</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl animate-[fadeIn_0.6s_ease-out_0.2s_both] text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-300">
              Sign, send, and manage documents securely. A modern platform for digital signatures
              and workflow management.
            </p>

            <div className="mb-16 flex animate-[fadeIn_0.6s_ease-out_0.3s_both] flex-col justify-center gap-4 sm:flex-row">
              <SignedIn>
                <Button
                  size="lg"
                  asChild
                  className="bg-brand-700 hover:bg-brand-800 shadow-brand-700/25 hover:shadow-brand-700/30 px-8 py-6 text-lg text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "go_to_app",
                      location: "hero",
                    })
                  }
                >
                  <Link to="/app" className="flex items-center gap-2">
                    Go to App
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </SignedIn>
              <SignedOut>
                <Button
                  size="lg"
                  asChild
                  className="bg-brand-700 hover:bg-brand-800 shadow-brand-700/25 hover:shadow-brand-700/30 px-8 py-6 text-lg text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "get_started_free",
                      location: "hero",
                    })
                  }
                >
                  <Link to="/sign-up" className="flex items-center gap-2">
                    Get Started Free
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-brand-700/20 text-brand-700 hover:bg-brand-50 hover:border-brand-700/40 border-2 px-8 py-6 text-lg transition-all duration-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() =>
                    capture("cta_clicked", {
                      button: "sign_in",
                      location: "hero",
                    })
                  }
                >
                  <Link to="/sign-in">Sign In</Link>
                </Button>
              </SignedOut>
            </div>

            <section
              aria-label="Key features"
              className="mx-auto grid max-w-3xl animate-[fadeIn_0.6s_ease-out_0.4s_both] grid-cols-1 gap-6 sm:grid-cols-3"
            >
              <article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="bg-brand-50 rounded-lg p-2 dark:bg-slate-800" aria-hidden="true">
                  <Shield className="text-brand-700 dark:text-brand-400 h-5 w-5" />
                </div>
                <h2 className="text-sm font-medium">Bank-level security</h2>
              </article>
              <article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="bg-brand-50 rounded-lg p-2 dark:bg-slate-800" aria-hidden="true">
                  <FileText className="text-brand-700 dark:text-brand-400 h-5 w-5" />
                </div>
                <h2 className="text-sm font-medium">Legally binding</h2>
              </article>
              <article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="bg-brand-50 rounded-lg p-2 dark:bg-slate-800" aria-hidden="true">
                  <CheckCircle2 className="text-brand-700 dark:text-brand-400 h-5 w-5" />
                </div>
                <h2 className="text-sm font-medium">Easy to use</h2>
              </article>
            </section>
          </article>

          {/* Pricing Section */}
          <section
            id="pricing"
            aria-label="Pricing plans"
            className="mx-auto mt-24 w-full max-w-5xl animate-[fadeIn_0.6s_ease-out_0.5s_both]"
          >
            <h2 className="mb-4 text-center text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600 dark:text-gray-400">
              Start for free, upgrade when you need more features.
            </p>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
              {/* Free Plan */}
              <div className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Free</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
                  <span className="text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                  Perfect for individuals getting started with document signing.
                </p>

                <ul className="mb-8 space-y-4">
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Check className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Full app access</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Users className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Single user workspace</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                    <X className="h-5 w-5 flex-shrink-0" />
                    <span>No API access</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                    <X className="h-5 w-5 flex-shrink-0" />
                    <span>No webhooks</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                    <X className="h-5 w-5 flex-shrink-0" />
                    <span>No MCP integration</span>
                  </li>
                </ul>

                <SignedOut>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-2 border-gray-200 py-6 text-base hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() =>
                      capture("cta_clicked", {
                        button: "get_started_free",
                        location: "pricing",
                      })
                    }
                  >
                    <Link to="/sign-up">Get Started Free</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-2 border-gray-200 py-6 text-base hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    <Link to="/app">Go to App</Link>
                  </Button>
                </SignedIn>
              </div>

              {/* Pro Plan */}
              <div className="border-brand-600 dark:border-brand-500 shadow-brand-600/10 relative rounded-2xl border-2 bg-white p-8 shadow-lg dark:bg-slate-900">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-600 rounded-full px-4 py-1 text-sm font-medium text-white">
                    Recommended
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Pro</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">$10</span>
                  <span className="text-gray-500 dark:text-gray-400">/seat/month</span>
                </div>
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                  For teams and businesses that need advanced integrations.
                </p>

                <ul className="mb-8 space-y-4">
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Check className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Everything in Free</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Users className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Unlimited team members</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Code2 className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Full API access</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Check className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>Webhooks</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <Check className="text-brand-600 dark:text-brand-400 h-5 w-5 flex-shrink-0" />
                    <span>MCP integration</span>
                  </li>
                </ul>

                <SignedOut>
                  <Button
                    asChild
                    className="bg-brand-600 hover:bg-brand-700 shadow-brand-600/20 w-full py-6 text-base text-white shadow-md"
                    onClick={() =>
                      capture("cta_clicked", {
                        button: "get_started_pro",
                        location: "pricing",
                      })
                    }
                  >
                    <Link to="/sign-up">Get Started</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button
                    asChild
                    className="bg-brand-600 hover:bg-brand-700 shadow-brand-600/20 w-full py-6 text-base text-white shadow-md"
                  >
                    <Link to="/app">Go to App</Link>
                  </Button>
                </SignedIn>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-brand-700/10 dark:bg-background/50 relative z-10 border-t bg-white/50 py-8 backdrop-blur-sm dark:border-slate-800">
          <div className="container mx-auto px-6 text-center text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Seal. All rights reserved.
          </div>
        </footer>
      </div>
    </GridLayout>
  );
}
