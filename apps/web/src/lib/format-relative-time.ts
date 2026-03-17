/**
 * Shared relative time formatting utility.
 *
 * Consolidates the duplicate formatDate / formatTimestamp helpers
 * that were inlined in the dashboard components.
 */

/**
 * Formats a timestamp (ms since epoch) as a human-readable relative string.
 *
 * - < 1 min  → "Just now"
 * - < 60 min → "12m ago"
 * - < 24 h   → "3h ago"
 * - < 7 d    → "2d ago"
 * - else     → "Mar 5"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
