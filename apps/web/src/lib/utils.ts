import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Error handling utilities for Convex mutations/actions
 */

export type ConvexErrorType =
	| "permission"
	| "not_found"
	| "validation"
	| "subscription"
	| "unknown";

interface ParsedError {
	type: ConvexErrorType;
	message: string;
	userFriendlyMessage: string;
}

/**
 * Parse a Convex error and return a user-friendly message
 */
export function parseConvexError(error: unknown): ParsedError {
	const message = error instanceof Error ? error.message : String(error);
	const lowerMessage = message.toLowerCase();

	// Permission errors
	if (
		lowerMessage.includes("insufficient permissions") ||
		lowerMessage.includes("permission") ||
		lowerMessage.includes("forbidden") ||
		lowerMessage.includes("not authorized") ||
		lowerMessage.includes("access denied")
	) {
		return {
			type: "permission",
			message,
			userFriendlyMessage:
				"You don't have permission to perform this action. Please contact your workspace administrator.",
		};
	}

	// Subscription/plan errors
	if (
		lowerMessage.includes("subscription") ||
		lowerMessage.includes("pro plan") ||
		lowerMessage.includes("upgrade")
	) {
		return {
			type: "subscription",
			message,
			userFriendlyMessage: message, // These are already user-friendly
		};
	}

	// Not found errors
	if (
		lowerMessage.includes("not found") ||
		lowerMessage.includes("does not exist")
	) {
		return {
			type: "not_found",
			message,
			userFriendlyMessage: "The requested resource could not be found.",
		};
	}

	// Validation errors (usually already user-friendly)
	if (
		lowerMessage.includes("invalid") ||
		lowerMessage.includes("required") ||
		lowerMessage.includes("must be") ||
		lowerMessage.includes("cannot be")
	) {
		return {
			type: "validation",
			message,
			userFriendlyMessage: message,
		};
	}

	// Unknown errors
	return {
		type: "unknown",
		message,
		userFriendlyMessage:
			message || "An unexpected error occurred. Please try again.",
	};
}

/**
 * Get a user-friendly error message from a Convex error
 */
export function getErrorMessage(error: unknown): string {
	return parseConvexError(error).userFriendlyMessage;
}
