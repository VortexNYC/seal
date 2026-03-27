/**
 * Formatting utility functions for dates, times, file sizes, and display text.
 */

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a file size in bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Format a timestamp as a full date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get initials from a name or email
 */
export function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email ? email[0].toUpperCase() : "?";
}

/**
 * Format an integer amount in cents as a currency string (e.g., 1234 → "$12.34").
 * Pass `options.minimumFractionDigits` / `options.maximumFractionDigits` to
 * override the default two-decimal-place formatting.
 */
export function formatCurrency(
  amountCents: number,
  currency = "USD",
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    ...options,
  }).format(amountCents / 100);
}

/**
 * Get a human-readable label for a document workflow status
 */
export function getStatusLabel(
  status:
    | "draft"
    | "sent"
    | "in_progress"
    | "waiting_for_payment"
    | "completed"
    | "cancelled"
    | "declined"
    | "expired"
    | undefined,
): string {
  const labels = {
    draft: "Draft",
    sent: "Sent",
    in_progress: "In Progress",
    waiting_for_payment: "Awaiting Payment",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
    expired: "Expired",
  };
  return labels[status ?? "draft"];
}
