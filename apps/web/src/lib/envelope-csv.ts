export interface EnvelopeCsvDocument {
  readonly name: string;
  readonly workflowStatus: string;
  readonly ownerName?: string | null;
  readonly ownerEmail?: string | null;
  readonly sentAt?: number | null;
  readonly deadline?: number | null;
}

export interface EnvelopeCsvRecipient {
  readonly name?: string | null;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly signedAt?: number | null;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function iso(value: number | null | undefined): string {
  if (value == null) return "";
  return new Date(value).toISOString();
}

export function envelopeCsv(input: {
  readonly document: EnvelopeCsvDocument;
  readonly recipients: readonly EnvelopeCsvRecipient[];
}): string {
  const header = [
    "Document",
    "Status",
    "Owner",
    "Owner email",
    "Sent",
    "Deadline",
    "Recipient",
    "Email",
    "Role",
    "Recipient status",
    "Signed",
  ];
  const people =
    input.recipients.length > 0
      ? input.recipients
      : [
          {
            name: "",
            email: "",
            role: "",
            status: "",
            signedAt: null,
          },
        ];
  const rows = people.map((recipient) => [
    input.document.name,
    input.document.workflowStatus,
    input.document.ownerName ?? "",
    input.document.ownerEmail ?? "",
    iso(input.document.sentAt),
    iso(input.document.deadline),
    recipient.name ?? "",
    recipient.email,
    recipient.role,
    recipient.status,
    iso(recipient.signedAt),
  ]);
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function envelopeCsvFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return `${slug.length > 0 ? slug : "envelope"}.csv`;
}
