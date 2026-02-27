/**
 * Folder Breadcrumbs
 *
 * Renders a clickable breadcrumb trail for folder navigation.
 * Root segment displays "All Documents" or "All Templates" based on type.
 * Intermediate folders are clickable; the last segment is the current page.
 */

import { useQuery } from "convex/react";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

interface FolderBreadcrumbsProps {
  folderId: Id<"folders">;
  type: "document" | "template";
  onNavigate: (folderId?: Id<"folders">) => void;
}

export function FolderBreadcrumbs({ folderId, type, onNavigate }: FolderBreadcrumbsProps) {
  const breadcrumbs = useQuery(api.folders.queries.getFolderBreadcrumbs, { folderId });

  const rootLabel = type === "document" ? "All Documents" : "All Templates";

  if (!breadcrumbs) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Root segment */}
        <BreadcrumbItem>
          <BreadcrumbLink
            className="flex cursor-pointer items-center gap-1.5"
            onClick={() => onNavigate(undefined)}
          >
            <Home className="size-3.5" />
            {rootLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>

        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <span key={crumb.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => onNavigate(crumb.id as Id<"folders">)}
                  >
                    {crumb.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
