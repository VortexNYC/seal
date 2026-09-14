import { Button } from "@cloudflare/kumo/components/button";
import { Download } from "@phosphor-icons/react";

import type { ApiContact } from "@/lib/api-client";

interface ExportContactsProps {
  contacts: ApiContact[];
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

export function ExportContacts({ contacts }: ExportContactsProps) {
  const handleExport = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company",
      "Title",
      "Status",
      "Notes",
      "Created",
    ];

    const rows = contacts.map((contact) => [
      escapeCSVField(contact.firstName),
      escapeCSVField(contact.lastName),
      escapeCSVField(contact.email),
      escapeCSVField(contact.phone ?? ""),
      escapeCSVField(contact.company ?? ""),
      escapeCSVField(contact.title ?? ""),
      escapeCSVField(contact.status),
      escapeCSVField(contact.notes ?? ""),
      formatCSVDate(contact.createdAt),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts-export-${date}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={contacts.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
