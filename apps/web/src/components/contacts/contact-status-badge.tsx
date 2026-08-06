import type { ContactStatus } from "@seal/backend/convex/schemas/contacts";

import { Badge } from "@/components/ui/badge";

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "inactive":
      return <Badge variant="secondary">Inactive</Badge>;
    case "lead":
      return <Badge variant="outline">Lead</Badge>;
    default:
      return null;
  }
}
