/**
 * Review matrix detail — doc × question grid, cell detail with grounded
 * citations, redline rail for pending revisions.
 * Route: /{slug}/reviews/{matrixId}
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  FileTextIcon,
  FilePenLineIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import {
  acceptRevision,
  getDocuments,
  getReviewMatrix,
  generateReviewMatrix,
  listRevisions,
  openReviewStream,
  proposeRevision,
  rejectRevision,
  type ApiReviewCell,
  type ApiReviewCitation,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/reviews/$matrixId")(
  {
    component: ReviewMatrixPage,
    head: () => ({
      meta: [
        { title: "Review matrix" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    }),
  }
);

const FLAG_STYLES: Record<string, { label: string; cls: string }> = {
  green: { label: "green", cls: "bg-green-500" },
  amber: { label: "amber", cls: "bg-amber-500" },
  red: { label: "red", cls: "bg-red-500" },
  grey: { label: "grey", cls: "bg-muted-foreground/40" },
};

const CELL_STATUS_DOT: Record<string, string> = {
  pending: "bg-muted-foreground/20",
  generating: "bg-blue-400 animate-pulse",
  done: "",
  error: "bg-red-300",
};

function ReviewMatrixPage() {
  const { slug, matrixId } = Route.useParams();
  const queryClient = useQueryClient();
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    cell: ApiReviewCell;
  } | null>(null);
  const streamRef = useRef<(() => void) | null>(null);

  const matrixQuery = useQuery({
    queryKey: ["review", slug, matrixId],
    queryFn: () => getReviewMatrix(slug, matrixId),
    refetchInterval: (q) =>
      q.state.data?.status === "generating" ? 4000 : false,
  });
  const docsQuery = useQuery({
    queryKey: ["api", "documents", "all", "all", undefined, slug],
    queryFn: () => getDocuments(slug, { filter: "all" }),
  });
  const matrix = matrixQuery.data;
  const docName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of docsQuery.data ?? []) map.set(d.publicId, d.name);
    return (id: string) => map.get(id) ?? id;
  }, [docsQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () => generateReviewMatrix(slug, matrixId),
    onSuccess: () => {
      toast.success("Generation started");
      void queryClient.invalidateQueries({
        queryKey: ["review", slug, matrixId],
      });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Live cell updates while generating — SSE carries the snapshots.
  useEffect(() => {
    if (matrix?.status !== "generating") return;
    if (streamRef.current) return;
    streamRef.current = openReviewStream(slug, matrixId, () => {
      void queryClient.invalidateQueries({
        queryKey: ["review", slug, matrixId],
      });
    });
    return () => {
      streamRef.current?.();
      streamRef.current = null;
    };
  }, [matrix?.status, slug, matrixId, queryClient]);

  if (!matrix) {
    return <PageWrapper title="Review">{null}</PageWrapper>;
  }

  const pendingCells = matrix.rows
    .flatMap((r) => r.cells)
    .filter((c) => c.status === "pending" || c.status === "error").length;
  const doneCells = matrix.rows
    .flatMap((r) => r.cells)
    .filter((c) => c.status === "done").length;

  return (
    <PageWrapper
      title={matrix.title}
      description={`${matrix.rows.length} documents × ${matrix.columns.length} questions — ${doneCells} done, ${pendingCells} pending`}
      action={{
        label:
          matrix.status === "generating"
            ? "Generating…"
            : pendingCells > 0
              ? "Generate"
              : "Regenerate",
        icon: PlayIcon,
        disabled: matrix.status === "generating" || generateMutation.isPending,
        onClick: () => generateMutation.mutate(),
      }}
    >
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Document</Table.Head>
                {matrix.columns.map((col) => (
                  <Table.Head key={col.index}>{col.name}</Table.Head>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {matrix.rows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell className="font-medium">
                    {docName(row.document_id)}
                  </Table.Cell>
                  {matrix.columns.map((col) => {
                    const cell = row.cells.find(
                      (c) => c.column_index === col.index
                    );
                    if (!cell) return <Table.Cell key={col.index} />;
                    const dot =
                      cell.status === "done"
                        ? FLAG_STYLES[cell.flag ?? "grey"]?.cls
                        : CELL_STATUS_DOT[cell.status];
                    return (
                      <Table.Cell key={col.index}>
                        <button
                          type="button"
                          data-testid={`cell-${row.id}-${col.index}`}
                          className="border-border hover:border-primary flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                          onClick={() =>
                            setSelectedCell({ rowId: row.id, cell })
                          }
                          title={cell.summary ?? cell.status}
                        >
                          <span
                            className={`inline-block size-2.5 rounded-full ${dot ?? ""}`}
                          />
                        </button>
                      </Table.Cell>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {selectedCell ? (
          <CellDetail
            slug={slug}
            cell={selectedCell.cell}
            documentId={
              matrix.rows.find((r) => r.id === selectedCell.rowId)
                ?.document_id ?? ""
            }
            documentName={docName(
              matrix.rows.find((r) => r.id === selectedCell.rowId)
                ?.document_id ?? ""
            )}
            onClose={() => setSelectedCell(null)}
          />
        ) : null}
      </div>

      <RevisionsRail slug={slug} matrix={matrix} />
    </PageWrapper>
  );
}

function CellDetail({
  slug,
  cell,
  documentId,
  documentName,
  onClose,
}: {
  slug: string;
  cell: ApiReviewCell;
  documentId: string;
  documentName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [proposeOpen, setProposeOpen] = useState(false);
  const flag = cell.flag ? FLAG_STYLES[cell.flag] : null;

  return (
    <aside className="border-border w-80 shrink-0 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{documentName}</div>
          {flag ? (
            <Badge variant={flag.label as never} className="mt-1">
              {flag.label}
            </Badge>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-3 text-sm">
        <div className="font-medium">Summary</div>
        <p className="text-muted-foreground mt-1">{cell.summary ?? "—"}</p>
      </div>
      {cell.reasoning ? (
        <div className="mt-3 text-sm">
          <div className="font-medium">Reasoning</div>
          <p className="text-muted-foreground mt-1">{cell.reasoning}</p>
        </div>
      ) : null}

      <div className="mt-3 text-sm">
        <div className="font-medium">Citations</div>
        <ul className="mt-1 flex flex-col gap-2">
          {cell.citations.map((cit, i) => (
            <CitationRow key={i} citation={cit} />
          ))}
          {cell.citations.length === 0 ? (
            <li className="text-muted-foreground text-xs">None</li>
          ) : null}
        </ul>
      </div>

      {cell.status === "done" ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => setProposeOpen(true)}
        >
          <FilePenLineIcon className="mr-1 size-4" />
          Propose redline
        </Button>
      ) : null}

      <ProposeDialog
        slug={slug}
        documentId={documentId}
        reviewCellId={cell.id}
        anchorQuote={
          cell.citations.find((c) => c.quote !== "not_found")?.quote ?? ""
        }
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        onProposed={() => {
          void queryClient.invalidateQueries({
            queryKey: ["revisions", slug],
          });
          setProposeOpen(false);
        }}
      />
    </aside>
  );
}

function CitationRow({ citation }: { citation: ApiReviewCitation }) {
  if (citation.quote === "not_found") {
    return (
      <li className="text-muted-foreground text-xs italic">
        not grounded in the document
      </li>
    );
  }
  return (
    <li className="border-border rounded-md border p-2 text-xs">
      <blockquote className="text-muted-foreground italic">
        “{citation.quote}”
      </blockquote>
      {citation.page ? (
        <div className="text-muted-foreground mt-1">
          p. {citation.page}
          {citation.bbox ? " · anchored" : ""}
        </div>
      ) : null}
    </li>
  );
}

function ProposeDialog({
  slug,
  documentId,
  reviewCellId,
  anchorQuote,
  open,
  onClose,
  onProposed,
}: {
  slug: string;
  documentId: string;
  reviewCellId: string;
  anchorQuote: string;
  open: boolean;
  onClose: () => void;
  onProposed: () => void;
}) {
  const [kind, setKind] = useState<"replace" | "insert" | "delete">("replace");
  const [quote, setQuote] = useState(anchorQuote);
  const [proposed, setProposed] = useState("");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    if (open) setQuote(anchorQuote);
  }, [open, anchorQuote]);

  const mutation = useMutation({
    mutationFn: () =>
      proposeRevision(slug, {
        document_id: documentId,
        kind,
        anchor_quote: quote.trim(),
        proposed_text: kind === "delete" ? undefined : proposed.trim(),
        rationale: rationale.trim() || undefined,
        review_cell_id: reviewCellId,
      }),
    onSuccess: () => {
      toast.success("Redline proposed");
      onProposed();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title>Propose a redline</Dialog.Title>
        <Dialog.Description>
          Stays pending until someone accepts — accepting produces a derived
          draft (or a Word tracked-changes file).
        </Dialog.Description>
        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Kind</span>
            <Select
              value={kind}
              onValueChange={(v) =>
                setKind((v ?? "replace") as "replace" | "insert" | "delete")
              }
            >
              <Select.Option value="replace">Replace</Select.Option>
              <Select.Option value="insert">Insert after</Select.Option>
              <Select.Option value="delete">Delete</Select.Option>
            </Select>
          </div>
          <Textarea
            label="Anchor quote (verbatim)"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={2}
          />
          {kind !== "delete" ? (
            <Textarea
              label={kind === "replace" ? "Replacement text" : "Inserted text"}
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
              rows={3}
            />
          ) : null}
          <Textarea
            label="Rationale (optional)"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !quote.trim() ||
              (kind !== "delete" && !proposed.trim()) ||
              mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            Propose
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function RevisionsRail({
  slug,
  matrix,
}: {
  slug: string;
  matrix: { rows: { document_id: string }[] };
}) {
  const queryClient = useQueryClient();
  const docIds = useMemo(
    () => new Set(matrix.rows.map((r) => r.document_id)),
    [matrix.rows]
  );
  const revisionsQuery = useQuery({
    queryKey: ["revisions", slug],
    queryFn: () => listRevisions(slug, { status: "pending" }),
  });
  const pending = (revisionsQuery.data ?? []).filter((r) =>
    docIds.has(r.document_id)
  );

  const resolve = useMutation({
    mutationFn: (args: {
      id: string;
      action: "accept" | "docx" | "reject";
    }) => {
      if (args.action === "reject") return rejectRevision(slug, args.id);
      return acceptRevision(
        slug,
        args.id,
        args.action === "docx" ? "docx" : "pdf"
      );
    },
    onSuccess: (rev, args) => {
      if (args.action === "reject") toast.success("Redline rejected");
      else
        toast.success(
          `Redline accepted — draft ${args.action === "docx" ? "with Word redlines" : "created"}`
        );
      void queryClient.invalidateQueries({ queryKey: ["revisions", slug] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (pending.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">
        Pending redlines ({pending.length})
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {pending.map((rev) => (
          <li
            key={rev.id}
            className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{rev.kind}</Badge>
                <span className="text-sm font-medium">
                  {rev.document_id.slice(0, 8)}…
                </span>
              </div>
              <blockquote className="text-muted-foreground mt-1 text-xs italic">
                “{rev.anchor_quote}”
              </blockquote>
              {rev.proposed_text ? (
                <p className="mt-1 text-xs">→ {rev.proposed_text}</p>
              ) : null}
              {rev.rationale ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {rev.rationale}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: rev.id, action: "accept" })}
              >
                <CheckIcon className="mr-1 size-3" /> PDF draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={resolve.isPending}
                title="Accept as a Word tracked-changes file"
                onClick={() => resolve.mutate({ id: rev.id, action: "docx" })}
              >
                <FileTextIcon className="mr-1 size-3" /> .docx
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: rev.id, action: "reject" })}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
