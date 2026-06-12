/**
 * Export Templates
 *
 * Client-side CSV export for the current templates list.
 * Downloads a CSV file with template details.
 */

import type { Doc } from "@seal/backend/convex/_generated/dataModel";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExportTemplatesProps {
  templates: Doc<"templates">[];
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCSVDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCSVBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

export function ExportTemplates({ templates }: ExportTemplatesProps) {
  const handleExport = () => {
    const headers = [
      "Name",
      "Description",
      "Status",
      "Pages",
      "File Size",
      "File Type",
      "Times Used",
      "Created",
    ];

    const rows = templates.map((template) => [
      escapeCSVField(template.name),
      escapeCSVField(template.description ?? ""),
      escapeCSVField(template.status),
      template.pageCount?.toString() ?? "",
      escapeCSVField(formatCSVBytes(template.fileSize)),
      escapeCSVField(template.fileType),
      template.useCount.toString(),
      formatCSVDate(template.createdAt),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const link = document.createElement("a");
    link.href = url;
    link.download = `templates-export-${date}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={templates.length === 0}>
      <DownloadIcon className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
