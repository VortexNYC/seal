import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playwrightStateDir = path.resolve(__dirname, "../../playwright/.auth");

export const authStatePath = path.resolve(playwrightStateDir, "user.json");
export const pdfStorageIdPath = path.resolve(
  playwrightStateDir,
  "e2e-pdf-storage-id.txt"
);
export const workspaceSlugPath = path.resolve(
  playwrightStateDir,
  "workspace-slug.txt"
);
export const sampleDocumentPath = path.resolve(
  __dirname,
  "sample-document.pdf"
);
