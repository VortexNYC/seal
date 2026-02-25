import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "~/components/ui/button";
import { FadeIn } from "~/components/ui/fade-in";

const codeExample = `curl -X POST https://api.seal.co/v1/documents \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Service Agreement",
    "file_url": "https://...",
    "recipients": [
      {
        "email": "jane@acme.com",
        "role": "signer"
      }
    ]
  }'`;

const highlights = [
  "Full REST API with typed responses",
  "Webhooks for every document event",
  "OpenAPI spec for code generation",
];

export function StaticDevelopers() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          {/* Left — copy */}
          <FadeIn>
            <div>
              <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
                For developers
              </p>
              <h2 className="text-foreground font-serif text-4xl tracking-tight text-balance sm:text-5xl">
                API-first, from day one
              </h2>
              <p className="text-muted-foreground mt-6 text-lg text-pretty">
                Build document signing into your product with a few API calls. Create documents, add
                recipients, collect signatures, and get webhook notifications — all programmatically.
              </p>

              <ul className="mt-8 space-y-3">
                {highlights.map((item) => (
                  <li className="text-foreground flex items-center gap-3 text-sm" key={item}>
                    <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Button asChild className="group" variant="outline">
                  <Link to="/docs">
                    Read the docs
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          {/* Right — code block */}
          <FadeIn delay={0.15}>
            <div className="border-border bg-card overflow-hidden rounded-xl border">
              <div className="border-border flex items-center gap-2 border-b px-4 py-3">
                <div aria-hidden="true" className="flex gap-1.5">
                  <div className="bg-border size-3 rounded-full" />
                  <div className="bg-border size-3 rounded-full" />
                  <div className="bg-border size-3 rounded-full" />
                </div>
                <span className="text-muted-foreground ml-3 text-xs font-medium">Terminal</span>
              </div>
              <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
                <code className="text-foreground/80 font-mono">{codeExample}</code>
              </pre>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
