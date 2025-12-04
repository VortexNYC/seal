/**
 * PDF utilities for extracting metadata and generating thumbnails
 * SEA-64: PDF Preview & Metadata
 */

import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker using local build
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

/**
 * Extract page count from PDF file
 */
export async function getPdfPageCount(file: File): Promise<number> {
	try {
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
		return pdf.numPages;
	} catch (error) {
		console.error("Error extracting PDF page count:", error);
		return 0;
	}
}

/**
 * Generate thumbnail from PDF first page
 * Returns a data URL of the thumbnail image
 */
export async function generatePdfThumbnail(
	file: File,
	maxWidth = 200,
	maxHeight = 300,
): Promise<string | null> {
	try {
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		// Get first page
		const page = await pdf.getPage(1);

		// Calculate viewport scale to fit within maxWidth x maxHeight
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(
			maxWidth / viewport.width,
			maxHeight / viewport.height,
		);
		const scaledViewport = page.getViewport({ scale });

		// Create canvas
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Could not get canvas context");
		}

		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		// Render page to canvas
		await page.render({
			canvasContext: context,
			viewport: scaledViewport,
			// biome-ignore lint: pdfjs types issue
		} as any).promise;

		// Convert canvas to data URL
		return canvas.toDataURL("image/png");
	} catch (error) {
		console.error("Error generating PDF thumbnail:", error);
		return null;
	}
}

/**
 * Generate thumbnail from PDF URL
 * Fetches the PDF from a URL and generates a thumbnail
 */
export async function generateThumbnailFromUrl(
	url: string,
	maxWidth = 200,
	maxHeight = 300,
): Promise<string | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch PDF: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		// Get first page
		const page = await pdf.getPage(1);

		// Calculate viewport scale to fit within maxWidth x maxHeight
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(
			maxWidth / viewport.width,
			maxHeight / viewport.height,
		);
		const scaledViewport = page.getViewport({ scale });

		// Create canvas
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Could not get canvas context");
		}

		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		// Render page to canvas
		await page.render({
			canvasContext: context,
			viewport: scaledViewport,
			// biome-ignore lint: pdfjs types issue
		} as any).promise;

		// Convert canvas to data URL
		return canvas.toDataURL("image/png");
	} catch (error) {
		console.error("Error generating PDF thumbnail from URL:", error);
		return null;
	}
}

/**
 * Extract both page count and thumbnail from PDF
 * Returns metadata object with pageCount and thumbnail
 */
export async function extractPdfMetadata(file: File): Promise<{
	pageCount: number;
	thumbnail: string | null;
}> {
	try {
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		const pageCount = pdf.numPages;

		// Generate thumbnail from first page
		const page = await pdf.getPage(1);
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(200 / viewport.width, 300 / viewport.height);
		const scaledViewport = page.getViewport({ scale });

		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) {
			return { pageCount, thumbnail: null };
		}

		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		await page.render({
			canvasContext: context,
			viewport: scaledViewport,
			// biome-ignore lint: pdfjs types issue
		} as any).promise;

		const thumbnail = canvas.toDataURL("image/png");

		return { pageCount, thumbnail };
	} catch (error) {
		console.error("Error extracting PDF metadata:", error);
		return { pageCount: 0, thumbnail: null };
	}
}
