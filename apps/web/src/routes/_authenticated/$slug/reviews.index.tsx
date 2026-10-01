/**
 * Reviews — legal review matrices over workspace documents.
 * Route: /{slug}/reviews
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PackageIcon, PlusIcon, ScaleIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import {
  createReviewMatrix,
  createReviewPack,
  deleteReviewPack,
  getDocuments,
  getReviewMatrices,
  getReviewPacks,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/reviews/")({
  component: ReviewsPage,
  head: () => ({
    meta: [
      { title: "Reviews" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ColumnDraft = { name: string; prompt: string };

const STATUS_VARIANT = {
  draft: "outline",
  generating: "info",
  ready: "success",
  error: "destructive",
} as const;

function ReviewsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);

  const matricesQuery = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => getReviewMatrices(slug),
  });
  const matrices = matricesQuery.data ?? [];

  return (
    <PageWrapper
      title="Reviews"
      description="Structured legal review — each document, each question, one cell with grounded citations."
      actions={[
        {
          label: "Packs",
          icon: PackageIcon,
          variant: "outline",
          onClick: () => setPacksOpen(true),
        },
        {
          label: "New review",
          icon: PlusIcon,
          onClick: () => setDialogOpen(true),
        },
      ]}
    >
      {matrices.length === 0 && !matricesQuery.isLoading ? (
        <Empty
          icon={<ScaleIcon />}
          title="No reviews yet"
          description="Create a review matrix — pick a pack like NDA review, choose documents, and your agent fills each cell with a grounded citation."
        />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Title</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Filled by</Table.Head>
              <Table.Head>Size</Table.Head>
              <Table.Head>Updated</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {matrices.map((m) => (
              <Table.Row
                key={m.id}
                data-testid={`matrix-row-${m.id}`}
                onClick={() =>
                  void navigate({
                    to: "/$slug/reviews/$matrixId",
                    params: { slug, matrixId: m.id },
                  })
                }
              >
                <Table.Cell>{m.title}</Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={
                      STATUS_VARIANT[m.status as keyof typeof STATUS_VARIANT] ??
                      "outline"
                    }
                  >
                    {m.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-muted-foreground">
                  {m.model.split("/").pop()}
                </Table.Cell>
                <Table.Cell>
                  {m.row_count} docs × {m.column_count} cols
                </Table.Cell>
                <Table.Cell className="text-muted-foreground">
                  {new Date(m.updated_at).toLocaleString()}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <PacksDialog
        slug={slug}
        open={packsOpen}
        onClose={() => setPacksOpen(false)}
      />

      <NewReviewDialog
        slug={slug}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          void queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
          void navigate({
            to: "/$slug/reviews/$matrixId",
            params: { slug, matrixId: id },
          });
        }}
      />
    </PageWrapper>
  );
}

function NewReviewDialog({
  slug,
  open,
  onClose,
  onCreated,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState("builtin/nda");
  const [docIds, setDocIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDraft[]>([
    { name: "", prompt: "" },
  ]);
  const [model, setModel] = useState("");

  const packsQuery = useQuery({
    queryKey: ["review-packs", slug],
    queryFn: () => getReviewPacks(slug),
    enabled: open,
  });
  const docsQuery = useQuery({
    queryKey: ["api", "documents", "all", "all", undefined, slug],
    queryFn: () => getDocuments(slug, { filter: "all" }),
    enabled: open,
  });

  const packs = packsQuery.data ?? [];
  const docs = (docsQuery.data ?? []).filter((d) => d.status === "draft");
  const selectedPack = packs.find((p) => p.id === packId);
  const isCustom = packId === "custom";

  const createMutation = useMutation({
    mutationFn: () =>
      createReviewMatrix(slug, {
        title: title.trim(),
        documentIds: [...docIds],
        pack_id: isCustom ? undefined : packId,
        model: isCustom ? model.trim() || undefined : undefined,
        columns: isCustom
          ? columns
              .filter((c) => c.name.trim() && c.prompt.trim())
              .map((c, i) => ({ index: i, name: c.name, prompt: c.prompt }))
          : undefined,
      }),
    onSuccess: (matrix) => {
      toast.success("Review created");
      onCreated(matrix.id);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canSubmit =
    title.trim().length > 0 &&
    docIds.size > 0 &&
    (isCustom
      ? columns.some((c) => c.name.trim() && c.prompt.trim()) &&
        model.trim().length > 0
      : packId.length > 0);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title>New review</Dialog.Title>
        <Dialog.Description>
          A matrix of extraction questions across your documents — each cell
          returns a grounded citation.
        </Dialog.Description>

        <div className="flex flex-col gap-4 py-2">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vendor NDA batch — Q3"
          />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Pack</span>
            <Select value={packId} onValueChange={(v) => setPackId(v ?? "")}>
              {packs.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.title}
                  {p.builtin ? " (built-in)" : ""}
                </Select.Option>
              ))}
              <Select.Option value="custom">Custom columns…</Select.Option>
            </Select>
            {selectedPack?.description ? (
              <p className="text-muted-foreground text-xs">
                {selectedPack.description}
              </p>
            ) : null}
          </div>

          {isCustom ? (
            <>
              <Input
                label="Reviewed by (optional)"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="agent/claude-opus-4-6"
                description="Provenance label — records which agent or model fills the cells. Seal never runs it."
              />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Columns</span>
                {columns.map((col, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={col.name}
                      onChange={(e) => {
                        const next = [...columns];
                        next[i] = { ...col, name: e.target.value };
                        setColumns(next);
                      }}
                      placeholder="Column name"
                    />
                    <Textarea
                      value={col.prompt}
                      onChange={(e) => {
                        const next = [...columns];
                        next[i] = { ...col, prompt: e.target.value };
                        setColumns(next);
                      }}
                      placeholder="Extraction prompt"
                      rows={1}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setColumns(columns.filter((_, j) => j !== i))
                      }
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setColumns([...columns, { name: "", prompt: "" }])
                  }
                >
                  Add column
                </Button>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              Documents ({docIds.size} selected)
            </span>
            <div className="border-border max-h-48 overflow-y-auto rounded-md border">
              {docs.length === 0 ? (
                <p className="text-muted-foreground p-3 text-xs">
                  No draft documents — upload one first.
                </p>
              ) : (
                docs.map((d) => (
                  <label
                    key={d.publicId}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={docIds.has(d.publicId)}
                      onCheckedChange={(checked) => {
                        const next = new Set(docIds);
                        if (checked === true) next.add(d.publicId);
                        else next.delete(d.publicId);
                        setDocIds(next);
                      }}
                    />
                    {d.name}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Create review"}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function PacksDialog({
  slug,
  open,
  onClose,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const packsQuery = useQuery({
    queryKey: ["review-packs", slug],
    queryFn: () => getReviewPacks(slug),
    enabled: open,
  });
  const packs = packsQuery.data ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [columns, setColumns] = useState<ColumnDraft[]>([
    { name: "", prompt: "" },
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      createReviewPack(slug, {
        title: title.trim(),
        description: description.trim() || undefined,
        model: model.trim() || undefined,
        columns: columns
          .filter((c) => c.name.trim() && c.prompt.trim())
          .map((c, i) => ({ index: i, name: c.name, prompt: c.prompt })),
      }),
    onSuccess: () => {
      toast.success("Pack created");
      void queryClient.invalidateQueries({ queryKey: ["review-packs", slug] });
      setTitle("");
      setDescription("");
      setModel("");
      setColumns([{ name: "", prompt: "" }]);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReviewPack(slug, id),
    onSuccess: () => {
      toast.success("Pack deleted");
      void queryClient.invalidateQueries({ queryKey: ["review-packs", slug] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const valid =
    title.trim().length > 0 &&
    columns.some((c) => c.name.trim() && c.prompt.trim());

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title>Review packs</Dialog.Title>
        <Dialog.Description>
          Packs bundle the columns a review matrix uses (plus an optional provenance label). Built-in packs
          are read-only; org packs are yours.
        </Dialog.Description>

        <ul className="mt-3 flex flex-col gap-2">
          {packs.map((p) => (
            <li
              key={p.id}
              className="border-border flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">
                  {p.title}
                  {p.builtin ? (
                    <Badge variant="outline" className="ml-2">
                      built-in
                    </Badge>
                  ) : null}
                </div>
                <div className="text-muted-foreground text-xs">
                  {p.columns.length} columns{p.model ? ` · ${p.model}` : ""}
                  {p.description ? ` — ${p.description}` : ""}
                </div>
              </div>
              {!p.builtin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(p.id)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="border-border mt-4 flex flex-col gap-3 border-t pt-4">
          <div className="text-sm font-medium">New pack</div>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vendor security review"
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Reviewed by (optional)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="agent/claude-opus-4-6"
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Columns</span>
            {columns.map((col, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={col.name}
                  onChange={(e) => {
                    const next = [...columns];
                    next[i] = { ...col, name: e.target.value };
                    setColumns(next);
                  }}
                  placeholder="Column name"
                />
                <Textarea
                  value={col.prompt}
                  onChange={(e) => {
                    const next = [...columns];
                    next[i] = { ...col, prompt: e.target.value };
                    setColumns(next);
                  }}
                  placeholder="Extraction prompt"
                  rows={1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColumns([...columns, { name: "", prompt: "" }])}
            >
              Add column
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={!valid || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create pack"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
