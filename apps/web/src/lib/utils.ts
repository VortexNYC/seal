// val-token:1776717855015
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Error handling utilities for API mutations/actions
 */

export type ApiErrorType =
  | "permission"
  | "not_found"
  | "validation"
  | "subscription"
  | "unknown";

interface ParsedError {
  type: ApiErrorType;
  message: string;
  userFriendlyMessage: string;
}

/**
 * Parse an API error and return a user-friendly message
 */
export function parseApiError(error: unknown): ParsedError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  // Strip common server error prefixes to get just the human-readable message.
  const apiMatch = rawMessage.match(
    /(?:ConvexError|Error):\s*(.+?)(?:\s+at\s+\w|\s+Called by client|$)/s
  );
  const message = apiMatch ? apiMatch[1].trim() : rawMessage;
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
    lowerMessage.includes("professional plan") ||
    lowerMessage.includes("upgrade")
  ) {
    return {
      type: "subscription",
      message,
      userFriendlyMessage:
        message ||
        "This feature requires a Professional plan. Please upgrade to continue.",
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
 * Get a user-friendly error message from an API error
 */
export function getErrorMessage(error: unknown): string {
  return parseApiError(error).userFriendlyMessage;
}

/**
 * Clamp a numeric value between a minimum and maximum bound.
 *
 * Returns `min` when `value < min`, `max` when `value > max`,
 * and `value` itself when it falls within the range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
