import { ApiReferenceReact } from "@scalar/api-reference-react";
import { createFileRoute } from "@tanstack/react-router";
import "@scalar/api-reference-react/style.css";

export const Route = createFileRoute("/api-reference")({
  component: ApiReferencePage,
});

function ApiReferencePage() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/openapi.yaml",
        theme: "default",
        layout: "modern",
        darkMode: false,
        hideDownloadButton: false,
        metaData: {
          title: "Seal API Reference",
          description:
            "Complete reference for the Seal REST API — documents, recipients, templates, signatures, and more.",
          ogTitle: "Seal API Reference",
        },
        servers: [{ url: "https://api.seal.app/api/v1", description: "Production" }],
        authentication: {
          preferredSecurityScheme: "ApiKeyAuth",
        },
      }}
    />
  );
}
