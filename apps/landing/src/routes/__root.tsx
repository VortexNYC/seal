/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/app/globals.css?url";
import { Footer } from "~/components/layout/footer";
import { Navbar } from "~/components/layout/navbar";

// Schema.org Organization structured data
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Seal",
  url: "https://seal.co",
  logo: "https://seal.co/favicon/og-image.png",
  description:
    "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@seal.co",
  },
};

// Schema.org SoftwareApplication structured data
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Seal",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Modern document signature platform with digital signatures, workflow management, and compliance-ready audit trails.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available",
  },
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Seal - Document Signatures Made Simple" },
      {
        name: "description",
        content:
          "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management. Free to start.",
      },
      {
        name: "keywords",
        content:
          "document signatures, e-signatures, digital signatures, document management, workflow automation, ESIGN compliant, DocuSign alternative",
      },
      { name: "author", content: "Seal" },
      { name: "robots", content: "index, follow" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: "https://seal.co" },
      { property: "og:site_name", content: "Seal" },
      {
        property: "og:title",
        content: "Seal - Document Signatures Made Simple",
      },
      {
        property: "og:description",
        content:
          "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
      },
      { property: "og:image", content: "https://seal.co/favicon/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@sealhq" },
      {
        name: "twitter:title",
        content: "Seal - Document Signatures Made Simple",
      },
      {
        name: "twitter:description",
        content:
          "Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
      },
      { name: "twitter:image", content: "https://seal.co/favicon/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://seal.co" },
      { rel: "icon", href: "/favicon/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon/favicon-iphone.png" },
      // DM Sans font from Google Fonts
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap",
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
  const isFullscreen = pathname.startsWith("/studio") || pathname.startsWith("/docs");

  return (
    <RootDocument>
      {isFullscreen ? (
        <Outlet />
      ) : (
        <div className="dark relative flex min-h-dvh flex-col">
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
    <html className="dark" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
