import type { JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  LayoutBlockOverlay,
  LayoutBlocksPanel,
  SchemaBuilderPanel,
  serializeSchema,
  type LayoutBlock,
  type SchemaBuilderSchema,
} from "@/components/kumo-docs";
import {
  getDocumentExtractionSchema,
  getDocumentLayoutBlocks,
  putDocumentExtractionSchema,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

function emptySchema(): SchemaBuilderSchema {
  return { properties: [] };
}

function schemaFromJson(value: Record<string, unknown>): SchemaBuilderSchema {
  const propertiesNode = value.properties;
  if (!propertiesNode || typeof propertiesNode !== "object") {
    return emptySchema();
  }
  const properties = Object.entries(
    propertiesNode as Record<string, unknown>
  ).map(([key, node]) => {
    const typed =
      node && typeof node === "object"
        ? (node as Record<string, unknown>)
        : {};
    const type =
      typeof typed.type === "string" ? typed.type : "string";
    return {
      id: crypto.randomUUID(),
      key,
      type: type as SchemaBuilderSchema["properties"][number]["type"],
      description:
        typeof typed.description === "string" ? typed.description : "",
      enumValues: Array.isArray(typed.enum)
        ? typed.enum.filter((v): v is string => typeof v === "string")
        : undefined,
    };
  });
  return { properties };
}

export function DocumentStructurePanel({
  organizationSlug,
  documentPublicId,
  canEdit,
  currentPage,
  pageWidth,
  pageHeight,
}: {
  organizationSlug: string;
  documentPublicId: string;
  canEdit: boolean;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const layoutQuery = useQuery({
    queryKey: ["documents", documentPublicId, "layout-blocks"],
    queryFn: () => getDocumentLayoutBlocks(organizationSlug, documentPublicId),
    staleTime: 60_000,
  });

  const schemaQuery = useQuery({
    queryKey: ["documents", documentPublicId, "extraction-schema"],
    queryFn: () =>
      getDocumentExtractionSchema(organizationSlug, documentPublicId),
    staleTime: 60_000,
  });

  const schema = useMemo(
    () =>
      schemaQuery.data?.schema
        ? schemaFromJson(schemaQuery.data.schema)
        : emptySchema(),
    [schemaQuery.data]
  );

  const saveSchema = useMutation({
    mutationFn: (next: SchemaBuilderSchema) =>
      putDocumentExtractionSchema(
        organizationSlug,
        documentPublicId,
        serializeSchema(next)
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", documentPublicId, "extraction-schema"],
      });
      toast.success("Extraction schema saved");
    },
    onError: (error) => {
      toast.error("Failed to save schema", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const blocks: LayoutBlock[] = layoutQuery.data?.blocks ?? [];

  return (
    <div className="space-y-4">
      <LayoutBlocksPanel
        blocks={blocks}
        activeId={activeBlockId}
        onSelect={(block) => setActiveBlockId(block.id)}
        className="border-border max-h-64 overflow-hidden rounded-xl border"
      />
      {pageWidth > 0 && pageHeight > 0 ? (
        <div className="border-border relative hidden overflow-hidden rounded-xl border lg:block">
          <div
            className="bg-muted relative"
            style={{ width: pageWidth, height: Math.min(pageHeight, 240) }}
          >
            <LayoutBlockOverlay
              blocks={blocks}
              page={currentPage}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              activeId={activeBlockId}
              onSelect={(block) => setActiveBlockId(block.id)}
            />
          </div>
        </div>
      ) : null}
      <SchemaBuilderPanel
        schema={schema}
        onChange={(next) => {
          if (!canEdit) return;
          saveSchema.mutate(next);
        }}
        className="border-border rounded-xl border"
      />
    </div>
  );
}
