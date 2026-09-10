/**
 * Folder Breadcrumbs
 *
 * Renders a clickable breadcrumb trail for folder navigation.
 * Root segment displays "All Documents" or "All Templates" based on type.
 * Intermediate folders are clickable; the last segment is the current page.
 */

import { useQuery } from "@tanstack/react-query";
import { Home } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getFolderBreadcrumbs } from "@/lib/api-client";

interface FolderBreadcrumbsProps {
  folderId?: string;
  type: "document" | "template";
  onNavigate: (folderId?: string) => void;
}

export function FolderBreadcrumbs({
  folderId,
  type,
  onNavigate,
}: FolderBreadcrumbsProps) {
  const { data: breadcrumbs } = useQuery({
    queryKey: ["api", "folders", "breadcrumbs", folderId],
    queryFn: () => getFolderBreadcrumbs(folderId!),
    enabled: Boolean(folderId),
  });

  const rootLabel = type === "document" ? "All Documents" : "All Templates";
  const breadcrumbItems = breadcrumbs ?? [];
  const breadcrumbSignature = [
    rootLabel,
    ...breadcrumbItems.map((crumb) => crumb.id),
  ].join("/");
  const previousDepthRef = useRef(breadcrumbItems.length);
  const previousSignatureRef = useRef(breadcrumbSignature);
  const hasMountedRef = useRef(false);
  const [motionOffset, setMotionOffset] = useState<
    "idle" | "from-left" | "from-right"
  >("idle");

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      previousDepthRef.current = breadcrumbItems.length;
      previousSignatureRef.current = breadcrumbSignature;
      return undefined;
    }

    const previousDepth = previousDepthRef.current;
    const previousSignature = previousSignatureRef.current;

    previousDepthRef.current = breadcrumbItems.length;
    previousSignatureRef.current = breadcrumbSignature;

    if (previousSignature === breadcrumbSignature) {
      return undefined;
    }

    const nextOffset =
      breadcrumbItems.length > previousDepth
        ? "from-right"
        : breadcrumbItems.length < previousDepth
          ? "from-left"
          : null;

    if (!nextOffset) {
      return undefined;
    }

    setMotionOffset(nextOffset);

    let resetFrame = 0;
    const startFrame = requestAnimationFrame(() => {
      resetFrame = requestAnimationFrame(() => {
        setMotionOffset("idle");
      });
    });

    return () => {
      cancelAnimationFrame(startFrame);
      cancelAnimationFrame(resetFrame);
    };
  }, [breadcrumbItems.length, breadcrumbSignature]);

  return (
    <Breadcrumb className="max-w-full min-w-0 overflow-hidden">
      <BreadcrumbList
        className="max-w-full flex-nowrap justify-center whitespace-nowrap motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform:
            motionOffset === "from-right"
              ? "translateX(12px)"
              : motionOffset === "from-left"
                ? "translateX(-12px)"
                : "translateX(0)",
        }}
      >
        {/* Root segment */}
        <BreadcrumbItem>
          <BreadcrumbLink
            className="text-foreground/80 hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1.5 font-medium"
            onClick={() => onNavigate(undefined)}
          >
            <Home className="size-3.5 shrink-0" />
            {rootLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>

        {breadcrumbItems.map((crumb, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <span key={crumb.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="max-w-40 truncate sm:max-w-56">
                    {crumb.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="max-w-32 cursor-pointer truncate sm:max-w-48"
                    onClick={() => onNavigate(crumb.id)}
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
