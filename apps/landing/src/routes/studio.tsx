import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [{ title: "Seal Studio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});
