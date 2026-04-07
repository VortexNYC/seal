/// <reference types="vite/client" />
import { ClerkProvider } from "@clerk/clerk-react";
import { createRootRoute, HeadContent, Outlet, Scripts, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import appCss from "~/app/globals.css?url";
import { Footer } from "~/components/layout/footer";
import { Navbar } from "~/components/layout/navbar";
import { initPostHog } from "~/lib/posthog";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Seal",
  url: "https://seal.co",
  logo: "https://seal.co/favicon/og-image.png",
  description:
    "Sign documents, collect payments, and automate workflows — all from one intelligent document platform.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@seal.co",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Seal",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Intelligent document platform with AI-powered field detection, built-in payment collection, and a full REST API.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available",
  },
};

// Static inline script to detect system dark mode preference before first paint.
// This prevents a flash of wrong theme. The string is a hardcoded constant — no user input.
const THEME_DETECTION_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('theme');if(s==='dark'){d.classList.add('dark');}else if(s==='light'){d.classList.remove('dark');}else{var m=window.matchMedia('(prefers-color-scheme:dark)');if(m.matches)d.classList.add('dark');m.addEventListener('change',function(e){if(!localStorage.getItem('theme')){e.matches?d.classList.add('dark'):d.classList.remove('dark');}});}}catch(e){}})()`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Seal — Documents that work for you" },
      {
        name: "description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API. Free to start.",
      },
      {
        name: "keywords",
        content:
          "document signatures, e-signatures, digital signatures, document intelligence, AI document platform, payment collection, API, DocuSign alternative",
      },
      { name: "author", content: "Seal" },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: "https://seal.co" },
      { property: "og:site_name", content: "Seal" },
      {
        property: "og:title",
        content: "Seal — Documents that work for you",
      },
      {
        property: "og:description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API.",
      },
      { property: "og:image", content: "https://seal.co/favicon/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@sealhq" },
      {
        name: "twitter:title",
        content: "Seal — Documents that work for you",
      },
      {
        name: "twitter:description",
        content:
          "Sign documents, collect payments, and let AI handle the rest. An intelligent document platform with a full REST API.",
      },
      { name: "twitter:image", content: "https://seal.co/favicon/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://seal.co" },
      { rel: "icon", href: "/favicon/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon/favicon-iphone.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationSchema),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(softwareSchema),
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { pathname } = useLocation();
  const isFullscreen = pathname.startsWith("/docs") || pathname.startsWith("/developer");

  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <RootDocument>
      {isFullscreen ? (
        <Outlet />
      ) : (
        <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
          <Navbar />
          <main className="flex-1">
            <Outlet />
          </main>
          <Footer />
        </div>
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Inline theme detection — static constant, no user input (safe from XSS) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_DETECTION_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{children}</ClerkProvider>
        ) : (
          children
        )}
        <Scripts />
      </body>
    </html>
  );
}
