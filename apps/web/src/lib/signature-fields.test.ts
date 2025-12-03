import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { countSignatureFields } from "./signature-fields";

const buildField = (
	fieldType: Doc<"signature_fields">["fieldType"],
	idSuffix: string,
): Doc<"signature_fields"> => ({
	_id: `field-${idSuffix}` as Id<"signature_fields">,
	_creationTime: 0,
	documentId: "doc-1" as Id<"documents">,
	recipientId: "recipient-1" as Id<"document_recipients">,
	fieldType,
	label: `${fieldType} field`,
	isRequired: false,
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	page: 1,
	createdAt: 0,
	updatedAt: 0,
});

describe("countSignatureFields", () => {
	it("returns 0 when there are no fields", () => {
		expect(countSignatureFields([])).toBe(0);
	});

	it("ignores non-signature field types", () => {
		const fields = [
			buildField("text", "text"),
			buildField("date", "date"),
			buildField("checkbox", "checkbox"),
		];

		expect(countSignatureFields(fields)).toBe(0);
	});

	it("counts only signature field types when mixed", () => {
		const fields = [
			buildField("signature", "primary"),
			buildField("text", "text"),
			buildField("signature", "secondary"),
		];

		expect(countSignatureFields(fields)).toBe(2);
	});
});
