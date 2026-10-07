import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
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
import { cn } from "@/lib/utils";

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
      node && typeof node === "object" ? (node as Record<string, unknown>) : {};
    const type = typeof typed.type === "string" ? typed.type : "string";
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

function useLayoutBlocks(
  organizationSlug: string,
  documentPublicId: string
): LayoutBlock[] {
  const layoutQuery = useQuery({
    queryKey: ["documents", documentPublicId, "layout-blocks"],
    queryFn: () => getDocumentLayoutBlocks(organizationSlug, documentPublicId),
    staleTime: 60_000,
  });
  return layoutQuery.data?.blocks ?? [];
}

export type DocumentLayoutCanvasOverlayProps = {
  organizationSlug: string;
  documentPublicId: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  activeBlockId: string | null;
  onActiveBlockIdChange: (id: string | null) => void;
};

/**
 * Layout blocks on the live DocumentCanvas page box (docked Layout capability).
 */
export function DocumentLayoutCanvasOverlay({
  organizationSlug,
  documentPublicId,
  currentPage,
  pageWidth,
  pageHeight,
  activeBlockId,
  onActiveBlockIdChange,
}: DocumentLayoutCanvasOverlayProps): JSX.Element | null {
  const blocks = useLayoutBlocks(organizationSlug, documentPublicId);
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }
  return (
    <LayoutBlockOverlay
      blocks={blocks}
      page={currentPage}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      activeId={activeBlockId}
      onSelect={(block) => onActiveBlockIdChange(block.id)}
    />
  );
}

export type DocumentStructurePanelProps = {
  organizationSlug: string;
  documentPublicId: string;
  canEdit: boolean;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  /** When true, sits under the live DocumentCanvas; mini preview is omitted. */
  docked?: boolean;
  activeBlockId?: string | null;
  onActiveBlockIdChange?: (id: string | null) => void;
};

export function DocumentStructurePanel({
  organizationSlug,
  documentPublicId,
  canEdit,
  currentPage,
  pageWidth,
  pageHeight,
  docked = false,
  activeBlockId: controlledActiveBlockId,
  onActiveBlockIdChange,
}: DocumentStructurePanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [uncontrolledActiveBlockId, setUncontrolledActiveBlockId] = useState<
    string | null
  >(null);
  const activeBlockId =
    controlledActiveBlockId !== undefined
      ? controlledActiveBlockId
      : uncontrolledActiveBlockId;
  const setActiveBlockId = (id: string | null): void => {
    onActiveBlockIdChange?.(id);
    if (controlledActiveBlockId === undefined) {
      setUncontrolledActiveBlockId(id);
    }
  };

  const blocks = useLayoutBlocks(organizationSlug, documentPublicId);

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

  return (
    <div
      data-testid="document-layout-capability"
      data-docked={docked ? "true" : "false"}
      className={cn(
        docked
          ? "border-kumo-line bg-kumo-base space-y-3 rounded-xl border p-3"
          : "space-y-4"
      )}
    >
      <LayoutBlocksPanel
        blocks={blocks}
        activeId={activeBlockId}
        onSelect={(block) => setActiveBlockId(block.id)}
        className="border-kumo-line max-h-64 overflow-hidden rounded-xl border"
      />
      {!docked && pageWidth > 0 && pageHeight > 0 ? (
        <div className="border-kumo-line relative hidden overflow-hidden rounded-xl border lg:block">
          <div
            className="bg-kumo-elevated relative"
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
        className="border-kumo-line rounded-xl border"
      />
    </div>
  );
}
