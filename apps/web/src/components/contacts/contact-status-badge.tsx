import { Badge } from "@cloudflare/kumo/components/badge";

import type { ContactStatus } from "@/lib/contact-status";

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  switch (status) {
    case "active":
      return <Badge variant="success">Active</Badge>;
    case "inactive":
      return <Badge variant="secondary">Inactive</Badge>;
    case "lead":
      return <Badge variant="outline">Lead</Badge>;
    default:
      return null;
  }
}
