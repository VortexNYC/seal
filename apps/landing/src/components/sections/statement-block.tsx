import { FadeIn } from "~/components/ui/fade-in";

export function StaticStatement() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <div className="mx-auto max-w-4xl text-center">
        <FadeIn>
          <h2
            className="text-foreground font-serif font-normal leading-[1.1] tracking-tight text-balance"
            style={{ fontSize: "clamp(2rem, 6vw, 4.5rem)" }}
          >
            Stop wrestling with your documents.{" "}
            <span className="text-primary">Start closing deals.</span>
          </h2>
        </FadeIn>
      </div>
    </section>
  );
}
