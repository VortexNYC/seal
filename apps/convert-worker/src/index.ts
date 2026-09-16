import { Container } from "@cloudflare/containers";
import { verifyInternalApiKey } from "@seal/internal-auth";
import { Hono } from "hono";

const ALLOWED_INPUT_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
]);

const FILE_EXTENSIONS: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/csv": ".csv",
};

export class Converter extends Container {
  override defaultPort = 3000;
  override sleepAfter = "60s";
}

type Bindings = {
  INTERNAL_API_KEY?: string;
  CONVERTER: DurableObjectNamespace<Converter>;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  if (c.req.path === "/health") {
    return next();
  }
  if (!verifyInternalApiKey(c)) {
    return c.text("unauthorized", 401);
  }
  return next();
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/convert", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;

  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }

  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }

  const form = new FormData();
  form.append("files", file, `document${FILE_EXTENSIONS[file.type]}`);

  const containerRequest = new Request(
    "http://internal/forms/libreoffice/convert",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="converted.pdf"',
    },
  });
});

export default app;
