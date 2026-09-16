import { z } from "zod";

const landingSchema = z.object({
  title: z.string(),
  description: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  cta: z.object({
    label: z.string(),
    href: z.string(),
  }),
});

export const landing = landingSchema.parse({
  title: "Seal — E-signatures, minus the bloat",
  description:
    "Seal is a fast, developer-friendly e-signature platform. Send, sign, and track documents without enterprise pricing games.",
  headline: "E-signatures, minus the bloat",
  subheadline:
    "Send, sign, and track documents in minutes. No seat math, no renewal surprises, no Acrobat-era UX.",
  cta: {
    label: "Start signing",
    href: "https://app.seal.nyc",
  },
});
