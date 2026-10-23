import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const page = doc.addPage([612, 792]);
const lines = [
  "NONDISCLOSURE AGREEMENT",
  "",
  "This Agreement is entered into between Audit Corp (Discloser) and",
  "Partner LLC (Recipient).",
  "",
  "1. CONFIDENTIALITY. Recipient shall hold Confidential Information",
  "   in strict confidence for five (5) years from disclosure.",
  "",
  "2. GOVERNING LAW. This Agreement is governed by New York law.",
  "",
  "Signature: ______________________    Date: __________",
  "Print Name: ______________________",
];
lines.forEach((t, i) => page.drawText(t, { x: 60, y: 700 - i * 22, size: 11, font, color: rgb(0,0,0) }));
const bytes = await doc.save();
await import("fs").then(fs => fs.writeFileSync("/tmp/audit-nda.pdf", bytes));
console.log("written", bytes.length);
