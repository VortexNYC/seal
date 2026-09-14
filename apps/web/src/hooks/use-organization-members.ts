import { useQuery } from "@tanstack/react-query";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

export interface OrganizationMemberView {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
  status: "active" | "pending";
}

function toView(
  member: {
    id: string;
    userId: string;
    role: string;
    user?: {
      name?: string | null;
      email?: string;
      image?: string | null;
    } | null;
  },
  status: "active" | "pending"
): OrganizationMemberView {
  return {
    userId: member.userId,
    name: member.user?.name ?? null,
    email: member.user?.email ?? member.userId,
    role: member.role,
    avatarUrl: member.user?.image ?? null,
    status,
  };
}

export function useOrganizationMembers(slug: string, enabled = true) {
  return useQuery({
    queryKey: ["organizations", slug, "members"],
    queryFn: async (): Promise<OrganizationMemberView[]> => {
      const client = getBetterAuthUiClient();
      if (
        client === null ||
        client.organization?.getFullOrganization === undefined
      ) {
        throw new Error("Organization members are not available.");
      }

      const response = await client.organization.getFullOrganization({
        query: { organizationSlug: slug },
      });
      if (response.error !== null) {
        throw new Error(response.error.message ?? "Could not load members.");
      }

      const org = response.data;
      if (org == null) return [];

      const active = org.members.map((member) => toView(member, "active"));
      const pending = org.invitations
        .filter((invitation) => invitation.status === "pending")
        .map((invitation) =>
          toView(
            {
              id: invitation.id,
              userId: invitation.id,
              role: invitation.role ?? "member",
              user: { name: null, email: invitation.email, image: null },
            },
            "pending"
          )
        );

      return [...active, ...pending];
    },
    enabled,
  });
}
