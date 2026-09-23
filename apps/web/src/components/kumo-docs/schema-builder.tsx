import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Plus, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type SchemaBuilderScalarType =
  | "string"
  | "number"
  | "integer"
  | "boolean";

export type SchemaBuilderFieldType =
  | SchemaBuilderScalarType
  | "enum"
  | "object"
  | "array";

export type SchemaBuilderProperty = {
  id: string;
  key: string;
  type: SchemaBuilderFieldType;
  description?: string;
  enumValues?: string[];
  properties?: SchemaBuilderProperty[];
  itemsType?: SchemaBuilderScalarType | "object";
};

export type SchemaBuilderSchema = {
  properties: SchemaBuilderProperty[];
};

export type SchemaBuilderProps = {
  schema: SchemaBuilderSchema;
  className?: string;
  onChange: (schema: SchemaBuilderSchema) => void;
};

const TYPE_OPTIONS: Array<{ value: SchemaBuilderFieldType; label: string }> = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
];

function newProp(): SchemaBuilderProperty {
  return {
    id: crypto.randomUUID(),
    key: "",
    type: "string",
    description: "",
  };
}

export function serializeSchema(
  schema: SchemaBuilderSchema
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    if (!prop.key.trim()) continue;
    const node: Record<string, unknown> = { type: prop.type };
    if (prop.description) node.description = prop.description;
    if (prop.type === "enum") node.enum = prop.enumValues ?? [];
    if (prop.type === "object" && prop.properties) {
      node.properties = serializeSchema({ properties: prop.properties });
    }
    if (prop.type === "array") {
      node.items = { type: prop.itemsType ?? "string" };
    }
    properties[prop.key] = node;
  }
  return { type: "object", properties };
}

/**
 * Extraction schema table + JSON — Extend schema-builder, Kumo-owned.
 */
export function SchemaBuilderPanel({
  schema,
  className,
  onChange,
}: SchemaBuilderProps): JSX.Element {
  const [tab, setTab] = useState<"form" | "json">("form");
  const json = useMemo(
    () => JSON.stringify(serializeSchema(schema), null, 2),
    [schema]
  );

  function updateProp(
    id: string,
    patch: Partial<SchemaBuilderProperty>
  ): void {
    onChange({
      properties: schema.properties.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    });
  }

  function removeProp(id: string): void {
    onChange({
      properties: schema.properties.filter((p) => p.id !== id),
    });
  }

  return (
    <div
      data-kumo-docs="schema-builder"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "form" ? "primary" : "ghost"}
          onClick={() => setTab("form")}
        >
          Form
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "json" ? "primary" : "ghost"}
          onClick={() => setTab("json")}
        >
          JSON
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() =>
            onChange({ properties: [...schema.properties, newProp()] })
          }
        >
          <Plus className="size-3.5" />
          Add property
        </Button>
      </div>

      {tab === "json" ? (
        <pre className="font-mono flex-1 overflow-auto p-3 text-xs whitespace-pre-wrap">
          {json}
        </pre>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {schema.properties.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No properties yet. Add a field key to start the schema.
            </p>
          ) : (
            schema.properties.map((prop) => (
              <div
                key={prop.id}
                className="border-border grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_8rem_1fr_auto]"
              >
                <Input
                  value={prop.key}
                  onChange={(e) => updateProp(prop.id, { key: e.target.value })}
                  placeholder="property_key"
                  className="font-mono text-xs"
                />
                <Select
                  value={prop.type}
                  onValueChange={(value) => {
                    if (!value) return;
                    updateProp(prop.id, {
                      type: value as SchemaBuilderFieldType,
                    });
                  }}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
                <Input
                  value={prop.description ?? ""}
                  onChange={(e) =>
                    updateProp(prop.id, { description: e.target.value })
                  }
                  placeholder="Description"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeProp(prop.id)}
                  aria-label={`Remove ${prop.key || "property"}`}
                >
                  <Trash className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
