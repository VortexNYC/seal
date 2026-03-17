import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [{ title: "Seal API Reference" }],
  }),
});
