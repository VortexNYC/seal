import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

import type { Doc } from "../_generated/dataModel";
import { applyRedaction, type RedactionLevel } from "./redaction";

interface RecipientInfo {
  name: string | null;
  email: string;
  phone?: string | null;
}

type PdfForm = ReturnType<PDFDocument["getForm"]>;

interface FieldLayout {
  x: number;
  pdfY: number;
  width: number;
  height: number;
}

function groupFieldsByPage(
  fields: Doc<"signature_fields">[],
): Map<number, Doc<"signature_fields">[]> {
  const fieldsByPage = new Map<number, Doc<"signature_fields">[]>();
  for (const field of fields) {
    const pageFields = fieldsByPage.get(field.page) ?? [];
    pageFields.push(field);
    fieldsByPage.set(field.page, pageFields);
  }
  return fieldsByPage;
}

function getFieldLayout(page: PDFPage, field: Doc<"signature_fields">): FieldLayout {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = (field.x / 100) * pageWidth;
  const y = (field.y / 100) * pageHeight;
  const width = (field.width / 100) * pageWidth;
  const height = (field.height / 100) * pageHeight;
  return {
    x,
    pdfY: pageHeight - y - height,
    width,
    height,
  };
}

async function addFormField(
  form: PdfForm,
  page: PDFPage,
  field: Doc<"signature_fields">,
  layout: FieldLayout,
  font: PDFFont,
  recipient: RecipientInfo | undefined,
  redactionLevel: RedactionLevel | undefined,
): Promise<void> {
  const fieldName = `${field.fieldType}_${field._id}`;

  switch (field.fieldType) {
    case "text":
    case "date":
      addTextField(form, page, fieldName, layout.x, layout.pdfY, layout.width, layout.height);
      return;
    case "checkbox":
      addCheckboxField(form, page, fieldName, layout.x, layout.pdfY, layout.width, layout.height);
      return;
    case "signature":
      await addSignaturePlaceholder(
        page,
        layout.x,
        layout.pdfY,
        layout.width,
        layout.height,
        font,
        recipient,
        redactionLevel,
      );
      return;
    case "dropdown":
      addDropdownField(
        form,
        page,
        fieldName,
        layout.x,
        layout.pdfY,
        layout.width,
        layout.height,
        field.properties?.options ?? [],
      );
      return;
    case "radio":
      addRadioField(
        form,
        page,
        fieldName,
        layout.x,
        layout.pdfY,
        layout.width,
        layout.height,
        field.properties?.options ?? [],
      );
      return;
    case "attachment":
      addAttachmentPlaceholder(page, layout.x, layout.pdfY, layout.width, layout.height, font);
      return;
  }
}

/**
 * Generate a fillable PDF with form fields based on signature field positions
 */
export async function generateFillablePdf(
  originalPdfBytes: ArrayBuffer,
  fields: Doc<"signature_fields">[],
  recipients: Map<string, RecipientInfo>,
  redactionLevel?: RedactionLevel,
): Promise<Uint8Array> {
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();

  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Group fields by page for easier processing
  const fieldsByPage = groupFieldsByPage(fields);

  // Process each page
  for (const [pageNumber, pageFields] of fieldsByPage) {
    const page = pages[pageNumber - 1]; // Pages are 0-indexed
    if (!page) continue;

    // Add form fields for each signature field
    for (const field of pageFields) {
      const recipient = field.recipientId ? recipients.get(field.recipientId) : undefined;
      const fieldName = `${field.fieldType}_${field._id}`;
      const layout = getFieldLayout(page, field);

      try {
        await addFormField(form, page, field, layout, helveticaBold, recipient, redactionLevel);
      } catch (error) {
        console.error(`Failed to add field ${fieldName}:`, error);
      }
    }
  }

  // Save the PDF with form fields
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Add a text field to the PDF form
 */
function addTextField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  fieldName: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const textField = form.createTextField(fieldName);
  textField.addToPage(page, {
    x,
    y,
    width,
    height,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
  });

  // Set placeholder text
  textField.setText("");
  textField.enableReadOnly();
  textField.disableReadOnly(); // Make it editable
}

/**
 * Add a checkbox field to the PDF form
 */
function addCheckboxField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  fieldName: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const checkBox = form.createCheckBox(fieldName);
  checkBox.addToPage(page, {
    x,
    y,
    width: Math.min(width, height), // Make it square
    height: Math.min(width, height),
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 2,
  });
}

/**
 * Add a signature placeholder to the PDF
 * This creates a visual signature field that can be filled in PDF readers
 */
async function addSignaturePlaceholder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
  recipient: RecipientInfo | undefined,
  redactionLevel?: RedactionLevel,
) {
  // Draw a rectangle border for the signature field
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.23, 0.51, 0.96), // Blue border
    borderWidth: 2,
    color: rgb(0.93, 0.95, 0.98), // Light blue background
  });

  // Add "Sign here" text
  const signText = "Sign here";
  const textWidth = font.widthOfTextAtSize(signText, 10);
  page.drawText(signText, {
    x: x + (width - textWidth) / 2,
    y: y + height / 2 - 3,
    size: 10,
    font,
    color: rgb(0.23, 0.51, 0.96),
  });

  // Add recipient info below if available
  if (recipient) {
    const displayName =
      recipient.name || applyRedaction(recipient.email, "email", redactionLevel) || "";
    const recipientTextSize = 8;
    const recipientTextWidth = font.widthOfTextAtSize(displayName, recipientTextSize);
    page.drawText(displayName, {
      x: x + (width - recipientTextWidth) / 2,
      y: y + 8,
      size: recipientTextSize,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Note: To make this a true digital signature field, you would need to use
  // pdflibAddPlaceholder from @signpdf/placeholder-pdf-lib
  // However, that requires additional setup and is typically done during the signing process
}

/**
 * Add a dropdown field to the PDF form
 */
function addDropdownField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  fieldName: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: string[],
) {
  const dropdown = form.createDropdown(fieldName);
  dropdown.addOptions(options.length > 0 ? options : ["Select an option"]);
  dropdown.addToPage(page, {
    x,
    y,
    width,
    height,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
  });
}

/**
 * Add a radio button group to the PDF form
 * Radio buttons are arranged vertically within the field bounds
 */
function addRadioField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  fieldName: string,
  x: number,
  y: number,
  _width: number,
  height: number,
  options: string[],
) {
  if (options.length === 0) {
    options = ["Option 1", "Option 2"];
  }

  const radioGroup = form.createRadioGroup(fieldName);

  // Calculate spacing for radio buttons
  const optionHeight = Math.min(height / options.length, 20);
  const radioSize = Math.min(optionHeight * 0.8, 12);

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (!option) continue;
    const optionY = y + height - (i + 1) * optionHeight;
    radioGroup.addOptionToPage(option, page, {
      x: x + 2,
      y: optionY,
      width: radioSize,
      height: radioSize,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 1,
    });
  }
}

/**
 * Add an attachment placeholder to the PDF
 */
async function addAttachmentPlaceholder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
) {
  // Draw a dashed rectangle border for the attachment field
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.97, 0.97, 0.97),
    borderDashArray: [4, 2],
  });

  // Add "Attach file" text
  const attachText = "Attach file";
  const textWidth = font.widthOfTextAtSize(attachText, 10);
  page.drawText(attachText, {
    x: x + (width - textWidth) / 2,
    y: y + height / 2 - 3,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}
