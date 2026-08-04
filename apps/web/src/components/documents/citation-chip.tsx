/**
 * Clickable citation chip that links to a specific document page.
 *
 * Parses structured citation markers from agent responses:
 * Format: <<cite:documentId:pageNumber:documentName>>
 */

import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CitationChipProps {
  documentId: string;
  pageNumber: number;
  documentName: string;
  slug: string;
}

export function CitationChip({
  documentId,
  pageNumber,
  documentName,
  slug,
}: CitationChipProps) {
  return (
    <Link
      to="/$slug/documents/$documentId"
      params={{ slug, documentId }}
      className="bg-ai-accent-surface text-ai-accent hover:bg-ai-accent-surface/80 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
    >
      <FileTextIcon className="h-3 w-3" />
      {documentName}
      {pageNumber > 0 && (
        <span className="text-ai-accent/70">p.{pageNumber}</span>
      )}
    </Link>
  );
}

/** Regex to match citation markers in agent text. */
const CITATION_REGEX = /<<cite:([^:]+):(\d+):([^>]+)>>/g;

/**
 * Parse agent text and replace citation markers with CitationChip components.
 * Returns an array of React nodes (strings and CitationChip elements).
 */
export function parseTextWithCitations(
  text: string,
  slug: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex state
  CITATION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null = CITATION_REGEX.exec(text);
  while (match !== null) {
    // Add text before this citation
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, documentId, pageStr, documentName] = match;
    const pageNumber = Number.parseInt(pageStr ?? "0", 10);

    nodes.push(
      <CitationChip
        key={`${documentId}-${pageNumber}-${match.index}`}
        documentId={documentId ?? ""}
        pageNumber={pageNumber}
        documentName={documentName ?? "Document"}
        slug={slug}
      />
    );

    lastIndex = match.index + match[0].length;
    match = CITATION_REGEX.exec(text);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
