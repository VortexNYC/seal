import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { Doc } from "../_generated/dataModel";

interface FieldPosition {
	x: number;
	y: number;
	width: number;
	height: number;
	page: number;
}

interface RecipientInfo {
	name: string | null;
	email: string;
}

/**
 * Generate a fillable PDF with form fields based on signature field positions
 */
export async function generateFillablePdf(
	originalPdfBytes: ArrayBuffer,
	fields: Doc<"signature_fields">[],
	recipients: Map<string, RecipientInfo>,
	documentName: string,
): Promise<Uint8Array> {
	// Load the original PDF
	const pdfDoc = await PDFDocument.load(originalPdfBytes);
	const pages = pdfDoc.getPages();
	const form = pdfDoc.getForm();

	// Load fonts
	const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	// Group fields by page for easier processing
	const fieldsByPage = new Map<number, Doc<"signature_fields">[]>();
	for (const field of fields) {
		const pageFields = fieldsByPage.get(field.page) || [];
		pageFields.push(field);
		fieldsByPage.set(field.page, pageFields);
	}

	// Process each page
	for (const [pageNumber, pageFields] of fieldsByPage) {
		const page = pages[pageNumber - 1]; // Pages are 0-indexed
		if (!page) continue;

		const { width: pageWidth, height: pageHeight } = page.getSize();

		// Add form fields for each signature field
		for (const field of pageFields) {
			const recipient = recipients.get(field.recipientId);
			const fieldName = `${field.fieldType}_${field._id}`;

			// Convert percentage coordinates back to pixels
			const x = (field.x / 100) * pageWidth;
			const y = (field.y / 100) * pageHeight;
			const width = (field.width / 100) * pageWidth;
			const height = (field.height / 100) * pageHeight;

			// PDF coordinates start from bottom-left, so we need to flip Y
			const pdfY = pageHeight - y - height;

			try {
				switch (field.fieldType) {
					case "text":
						addTextField(
							form,
							page,
							fieldName,
							x,
							pdfY,
							width,
							height,
							helveticaFont,
							field.label,
						);
						break;

					case "date":
						addTextField(
							form,
							page,
							fieldName,
							x,
							pdfY,
							width,
							height,
							helveticaFont,
							field.label,
						);
						break;

					case "checkbox":
						addCheckboxField(form, page, fieldName, x, pdfY, width, height);
						break;

					case "signature":
						// For signature fields, we'll add a placeholder that can be digitally signed
						// Note: This creates a visual placeholder, actual signing requires @signpdf/signpdf
						await addSignaturePlaceholder(
							pdfDoc,
							page,
							fieldName,
							x,
							pdfY,
							width,
							height,
							helveticaBold,
							recipient,
						);
						break;
				}
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
	font: PDFFont,
	label: string,
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
		font,
		fontSize: 11,
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
	pdfDoc: PDFDocument,
	page: PDFPage,
	fieldName: string,
	x: number,
	y: number,
	width: number,
	height: number,
	font: PDFFont,
	recipient: RecipientInfo | undefined,
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
		const recipientText = recipient.name || recipient.email;
		const recipientTextSize = 8;
		const recipientTextWidth = font.widthOfTextAtSize(
			recipientText,
			recipientTextSize,
		);
		page.drawText(recipientText, {
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
 * Helper to convert field type to display name
 */
function getFieldTypeDisplay(fieldType: string): string {
	const displays: Record<string, string> = {
		signature: "Signature",
		text: "Text",
		date: "Date",
		checkbox: "Checkbox",
	};
	return displays[fieldType] || fieldType;
}
