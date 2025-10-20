# PDF Library Architecture

**Purpose**: Clear breakdown of our PDF processing stack and what each library does.

---

## 🎯 Overview

We use **multiple PDF libraries** because PDF operations fall into distinct categories that require specialized tools. No single library does everything we need efficiently.

**Our PDF Stack**:
1. **react-pdf** - Display PDFs in the browser
2. **@react-pdf-viewer/core** - Rich PDF viewer UI
3. **PDF-lib** - Manipulate PDF documents

**Important**: We are **NOT generating PDFs from scratch**. Users upload existing PDFs which we then display and modify.

---

## 📚 Library Breakdown

### 1. react-pdf

**Purpose**: Render PDF pages as images/canvas in React components

**GitHub**: https://github.com/wojtekmaj/react-pdf
**Technology**: Built on PDF.js (Mozilla's PDF rendering engine)

**What it does**:
- Converts PDF pages to canvas/image elements
- Handles PDF parsing and rendering
- Provides React components for PDF display
- Manages PDF document loading state

**When we use it**:
- Displaying PDF documents in the browser
- Field placement interface (showing the PDF while user adds signature fields)
- Document preview during upload
- Signer viewing document before signing

**Example Use Case**:
```tsx
import { Document, Page } from 'react-pdf';

// Display PDF for field placement
<Document file={pdfUrl}>
  <Page pageNumber={1} />
</Document>
```

**What it does NOT do**:
- ❌ Add interactive controls (zoom, search, navigation)
- ❌ Modify PDF content
- ❌ Add signature fields to PDF
- ❌ Generate PDFs from scratch

---

### 2. @react-pdf-viewer/core

**Purpose**: Rich PDF viewer UI with user interaction features

**GitHub**: https://github.com/react-pdf-viewer/react-pdf-viewer
**Also Built On**: PDF.js

**What it does**:
- Provides toolbar with zoom controls
- Search functionality within PDF
- Page navigation (jump to page, next/prev)
- Thumbnail previews
- Rotation controls
- Print functionality
- Keyboard shortcuts
- Full-screen mode

**When we use it**:
- Document preparation interface (sender adding fields)
- Document signing interface (signer viewing and signing)
- Document review/preview
- Anywhere users need full PDF interaction

**Example Use Case**:
```tsx
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';

// Full-featured PDF viewer
const toolbarPluginInstance = toolbarPlugin();

<Worker workerUrl="...">
  <Viewer
    fileUrl={pdfUrl}
    plugins={[toolbarPluginInstance]}
  />
</Worker>
```

**What it does NOT do**:
- ❌ Modify PDF content
- ❌ Add signature fields to PDF
- ❌ Save changes to PDF
- ❌ Generate PDFs from scratch

**Relationship with react-pdf**:
- Both use PDF.js under the hood
- @react-pdf-viewer provides UI layer on top
- We might use @react-pdf-viewer for most viewer scenarios
- react-pdf for simpler, custom rendering needs

---

### 3. PDF-lib

**Purpose**: Low-level PDF document manipulation

**GitHub**: https://github.com/Hopding/pdf-lib
**Technology**: Pure JavaScript PDF manipulation (no dependencies)

**What it does**:
- Read and parse existing PDF files
- Add form fields (signature boxes, text fields, checkboxes)
- Modify existing form fields
- Embed images into PDFs
- Flatten PDFs (make fields non-editable)
- Add pages, remove pages
- Merge PDFs
- Set metadata
- Encrypt/decrypt PDFs

**When we use it**:
- **Adding signature fields** to PDF during document preparation
- **Adding text fields** (name, date, etc.) to PDF
- **Flattening PDF** after all signatures collected (make it final)
- **Embedding signature images** into PDF at specific coordinates
- **Adding stamps/watermarks** (e.g., "Signed on...")
- **Metadata updates** (title, author, etc.)

**Example Use Cases**:

**Adding a signature field to PDF:**
```typescript
import { PDFDocument } from 'pdf-lib';

// Load existing PDF
const pdfDoc = await PDFDocument.load(existingPdfBytes);
const pages = pdfDoc.getPages();
const firstPage = pages[0];

// Add signature field at specific coordinates
const form = pdfDoc.getForm();
const signatureField = form.createTextField('signature1');
signatureField.addToPage(firstPage, {
  x: 100,
  y: 200,
  width: 200,
  height: 50,
});

// Save modified PDF
const modifiedPdfBytes = await pdfDoc.save();
```

**Embedding signature image into PDF:**
```typescript
import { PDFDocument } from 'pdf-lib';

// Load PDF and signature image
const pdfDoc = await PDFDocument.load(pdfBytes);
const signatureImage = await pdfDoc.embedPng(signaturePngBytes);

const page = pdfDoc.getPages()[0];
page.drawImage(signatureImage, {
  x: 100,
  y: 200,
  width: 200,
  height: 50,
});

const finalPdf = await pdfDoc.save();
```

**Flattening PDF (making it final):**
```typescript
import { PDFDocument } from 'pdf-lib';

const pdfDoc = await PDFDocument.load(pdfBytes);
const form = pdfDoc.getForm();

// Flatten all fields (makes them non-editable)
form.flatten();

const flattenedPdf = await pdfDoc.save();
```

**What it does NOT do**:
- ❌ Display PDFs in the browser (that's react-pdf's job)
- ❌ Provide UI controls (zoom, search, etc.)
- ❌ Generate beautiful PDFs from templates

---

## 🔄 How They Work Together

### User Flow Example: Document Preparation

**Step 1: Display PDF (react-pdf + @react-pdf-viewer)**
```tsx
// Show PDF with zoom/navigation controls
<Viewer fileUrl={uploadedPdf} plugins={[toolbarPlugin]} />
```

**Step 2: User Clicks to Add Signature Field**
```tsx
// User clicks on PDF at coordinates (x: 150, y: 300)
onClick={(x, y) => {
  // Store field position
  addSignatureField({ x, y, page: currentPage });
}}
```

**Step 3: Save PDF with Fields (PDF-lib)**
```typescript
// When user clicks "Send for Signature"
const pdfDoc = await PDFDocument.load(originalPdfBytes);
const form = pdfDoc.getForm();

// Add all signature fields user created
signatureFields.forEach(field => {
  const sigField = form.createTextField(field.id);
  sigField.addToPage(pdfDoc.getPages()[field.page], {
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
  });
});

const pdfWithFields = await pdfDoc.save();
// Send this to recipient
```

### User Flow Example: Signing Document

**Step 1: Display PDF (react-pdf + @react-pdf-viewer)**
```tsx
// Signer views document with signature fields highlighted
<Viewer fileUrl={pdfWithFields} />
```

**Step 2: Signer Creates Signature**
```tsx
// Using react-signature-canvas (separate library)
import SignatureCanvas from 'react-signature-canvas';

<SignatureCanvas onEnd={captureSignature} />
```

**Step 3: Embed Signature into PDF (PDF-lib)**
```typescript
const pdfDoc = await PDFDocument.load(pdfWithFieldsBytes);
const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

const page = pdfDoc.getPages()[signatureFieldPage];
page.drawImage(signatureImage, {
  x: signatureField.x,
  y: signatureField.y,
  width: signatureField.width,
  height: signatureField.height,
});

// Flatten to make final
const form = pdfDoc.getForm();
form.flatten();

const finalSignedPdf = await pdfDoc.save();
```

---

## 🚫 What We're NOT Using

### ❌ react-pdf/renderer
**Purpose**: Generate PDFs from React components (like creating invoices from templates)

**Why we don't need it**:
- We're not generating PDFs from scratch
- Users upload existing PDFs
- We only need to display and modify existing PDFs

### ❌ pdfmake
**Purpose**: Generate PDFs using JavaScript objects

**Why we don't need it**:
- Same reason - not generating PDFs
- Only working with uploaded PDFs

### ❌ jsPDF
**Purpose**: Generate PDFs from scratch

**Why we don't need it**:
- Not generating PDFs
- PDF-lib handles all our modification needs

---

## 📊 Library Comparison Table

| Library | Display PDF | UI Controls | Modify PDF | Generate PDF |
|---------|-------------|-------------|------------|--------------|
| **react-pdf** | ✅ | ❌ | ❌ | ❌ |
| **@react-pdf-viewer** | ✅ | ✅ | ❌ | ❌ |
| **PDF-lib** | ❌ | ❌ | ✅ | ⚠️ (can create, but not our use case) |
| react-pdf/renderer | ❌ | ❌ | ❌ | ✅ |
| pdfmake | ❌ | ❌ | ❌ | ✅ |
| jsPDF | ❌ | ❌ | ⚠️ | ✅ |

---

## 🎯 Summary

**Our PDF workflow**:

1. **User uploads PDF** → Store in Convex
2. **Display PDF** → Use `@react-pdf-viewer/core` for rich viewing
3. **Add signature fields** → Use `PDF-lib` to modify PDF structure
4. **Show PDF to signer** → Use `@react-pdf-viewer/core` again
5. **Embed signatures** → Use `PDF-lib` to place signature images
6. **Flatten PDF** → Use `PDF-lib` to make document final
7. **Display final PDF** → Use `@react-pdf-viewer/core` for viewing

**Why three libraries?**
- **Display** = react-pdf + @react-pdf-viewer (PDF.js based)
- **Modify** = PDF-lib (low-level manipulation)
- They solve different problems and work together perfectly

---

**Last Updated**: 2025-10-20
**Related Files**:
- Vision Document: `/docusign-oss-vision.md`
- Feature #8: Document Upload - `/features/document-management/document-upload/feature-spec.md`
- Feature #7: Document Preparation - `/features/signature-workflow/document-preparation/feature-spec.md`
