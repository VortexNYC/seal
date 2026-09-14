import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { House } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useLayoutEffect, useRef, useState } from "react";

import { getFolderBreadcrumbs } from "@/lib/api-client";
import { buildOrganizationPath } from "@/lib/organization-path";

interface FolderBreadcrumbsProps {
  folderId?: string;
  type: "document" | "template";
  organizationSlug: string;
}

export function FolderBreadcrumbs({
  folderId,
  type,
  organizationSlug,
}: FolderBreadcrumbsProps) {
  const { data: breadcrumbs } = useQuery({
    queryKey: ["api", "folders", "breadcrumbs", folderId],
    queryFn: () => getFolderBreadcrumbs(organizationSlug, folderId!),
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

  const rootHref = buildOrganizationPath(
    organizationSlug,
    type === "document" ? "documents" : "templates"
  );

  const getFolderHref = (targetFolderId: string) =>
    buildOrganizationPath(
      organizationSlug,
      `${type === "document" ? "documents" : "templates"}?folderId=${targetFolderId}`
    );

  return (
    <div
      className="max-w-full min-w-0 overflow-hidden"
      style={{
        transform:
          motionOffset === "from-right"
            ? "translateX(12px)"
            : motionOffset === "from-left"
              ? "translateX(-12px)"
              : "translateX(0)",
      }}
    >
      <Breadcrumbs className="max-w-full">
        <Breadcrumbs.Link
          href={rootHref}
          icon={<House className="h-3.5 w-3.5" />}
        >
          {rootLabel}
        </Breadcrumbs.Link>
        {breadcrumbItems.map((crumb, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <Fragment key={crumb.id}>
              <Breadcrumbs.Separator />
              {isLast ? (
                <Breadcrumbs.Current>{crumb.name}</Breadcrumbs.Current>
              ) : (
                <Breadcrumbs.Link href={getFolderHref(crumb.id)}>
                  <span className="max-w-32 truncate sm:max-w-48">
                    {crumb.name}
                  </span>
                </Breadcrumbs.Link>
              )}
            </Fragment>
          );
        })}
      </Breadcrumbs>
    </div>
  );
}
