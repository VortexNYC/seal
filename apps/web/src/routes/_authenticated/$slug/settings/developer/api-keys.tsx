/**
 * Developer Settings - API Keys
 *
 * Core VortexApiKeyCreateForm + VortexApiKeyList; Seal Convex mutations for
 * create / rotate / revoke. Route: /{slug}/settings/developer/api-keys
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  getVortexApiKeyExpiresAt,
  parseVortexApiKeyAllowedIpRanges,
  type VortexApiKeyListItem,
  VortexApiKeyCreateForm,
  VortexApiKeyList,
} from "@vortexnyc/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/api-keys"
)({
  component: ApiKeysPage,
  pendingComponent: FormSkeleton,
});

type ApiScope =
  | "seal:documents:read"
  | "seal:documents:write"
  | "seal:templates:read"
  | "seal:templates:write"
  | "seal:recipients:read"
  | "seal:recipients:write"
  | "seal:signatures:read"
  | "seal:webhooks:manage"
  | "seal:members:read"
  | "seal:settings:read"
  | "seal:settings:write"
  | "seal:audit:read"
  | "seal:contacts:read"
  | "seal:contacts:write";

const SCOPE_OPTIONS: readonly ApiScope[] = [
  "seal:documents:read",
  "seal:documents:write",
  "seal:templates:read",
  "seal:templates:write",
  "seal:recipients:read",
  "seal:recipients:write",
  "seal:signatures:read",
  "seal:webhooks:manage",
  "seal:members:read",
  "seal:settings:read",
  "seal:settings:write",
  "seal:audit:read",
  "seal:contacts:read",
  "seal:contacts:write",
];

const DEFAULT_SCOPES: ApiScope[] = [
  "seal:documents:read",
  "seal:documents:write",
];

const SCOPE_SET = new Set<string>(SCOPE_OPTIONS);

function isApiScope(value: string): value is ApiScope {
  return SCOPE_SET.has(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong";
}

function toApiKeyListItems(
  data:
    | ReadonlyArray<{
        _id: string;
        name: string;
        keyPrefix: string;
        scopes: readonly string[];
        allowedIpRanges: readonly string[];
        expiresAt?: number;
        status: "active" | "revoked";
        lastUsedAt?: number;
        lastUsedIp?: string;
        createdAt: number;
        updatedAt?: number;
        createdBy: {
          _id: string;
          name?: string;
          email: string;
        } | null;
      }>
    | undefined
): VortexApiKeyListItem<ApiScope>[] | undefined {
  if (data === undefined) {
    return undefined;
  }
  return data.map((key) => ({
    _id: key._id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes.filter(isApiScope),
    allowedIpRanges: key.allowedIpRanges,
    expiresAt: key.expiresAt,
    status: key.status,
    lastUsedAt: key.lastUsedAt,
    lastUsedIp: key.lastUsedIp,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
    createdBy: key.createdBy
      ? {
          _id: key.createdBy._id,
          name: key.createdBy.name,
          email: key.createdBy.email,
        }
      : undefined,
  }));
}

function ApiKeysPage() {
  const createApiKey = useMutation(api.api_keys.keys.createApiKey);
  const revokeApiKey = useMutation(api.api_keys.keys.revokeApiKey);
  const rotateApiKey = useMutation(api.api_keys.keys.rotateApiKey);
  const apiKeysData = useQuery(api.api_keys.keys.listApiKeys, {});

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(() => [...DEFAULT_SCOPES]);
  const [ipAllowlist, setIpAllowlist] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("none");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [pendingRotateId, setPendingRotateId] = useState<string | null>(null);

  const apiKeys = toApiKeyListItems(apiKeysData);

  const handleCreate = () => {
    if (creating) {
      return;
    }
    setCreating(true);
    const allowedIpRanges = parseVortexApiKeyAllowedIpRanges(ipAllowlist);
    const expiresAt = getVortexApiKeyExpiresAt(expiresInDays);
    void createApiKey({
      name: name.trim(),
      scopes,
      ...(allowedIpRanges.length > 0 ? { allowedIpRanges } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    })
      .then((result) => {
        setCreatedToken(result.secret);
        setName("");
        setIpAllowlist("");
        setExpiresInDays("none");
        setScopes([...DEFAULT_SCOPES]);
        toast.success("API key created — copy it now; it is shown once.");
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      })
      .finally(() => {
        setCreating(false);
      });
  };

  const handleRevoke = (apiKeyId: string) => {
    setPendingRevokeId(apiKeyId);
  };

  const confirmRevoke = () => {
    if (!pendingRevokeId) {
      return;
    }
    const apiKeyId = pendingRevokeId;
    setPendingRevokeId(null);
    void revokeApiKey({ apiKeyId })
      .then(() => {
        toast.success("API key revoked");
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      });
  };

  const handleRotate = (apiKeyId: string) => {
    setPendingRotateId(apiKeyId);
  };

  const confirmRotate = () => {
    if (!pendingRotateId) {
      return;
    }
    const apiKeyId = pendingRotateId;
    setPendingRotateId(null);
    void rotateApiKey({ apiKeyId })
      .then((result) => {
        setCreatedToken(result.secret);
        toast.success("API key rotated — copy the new token now.");
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      });
  };

  return (
    <PageWrapper
      description="Manage API keys for programmatic access to Seal"
      title="API Keys"
    >
      <FeatureGate
        description="Create API keys to integrate Seal with your systems."
        feature="API access"
        tier="pro"
      >
        <div className="space-y-6">
          <VortexApiKeyCreateForm<ApiScope>
            apiEnabled
            creating={creating}
            onExpiresInDaysChange={setExpiresInDays}
            onIpAllowlistChange={setIpAllowlist}
            onNameChange={setName}
            onScopesChange={setScopes}
            onSubmit={handleCreate}
            scopeOptions={SCOPE_OPTIONS}
            state={{
              expiresInDays,
              ipAllowlist,
              name,
              scopes,
            }}
          />

          {createdToken ? (
            <Card>
              <CardHeader>
                <CardTitle>Copy this key now</CardTitle>
                <CardDescription>
                  It will not be shown again. Store it somewhere safe.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="bg-muted flex-1 rounded-md p-3 text-xs break-all">
                  {createdToken}
                </code>
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(createdToken)
                      .then(() => {
                        toast.success("Copied to clipboard");
                      });
                  }}
                  type="button"
                >
                  Copy
                </Button>
                <Button
                  onClick={() => {
                    setCreatedToken(null);
                  }}
                  type="button"
                  variant="outline"
                >
                  Done
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <VortexApiKeyList<ApiScope>
            apiKeys={apiKeys}
            copy={{
              emptyMessage: "No API keys created yet.",
            }}
            onRevoke={handleRevoke}
            onRotate={handleRotate}
          />
        </div>
      </FeatureGate>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingRevokeId(null);
          }
        }}
        open={pendingRevokeId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately invalidates the key and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep key</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingRotateId(null);
          }
        }}
        open={pendingRotateId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This invalidates the old token. The replacement is shown once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current key</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRotate}>
              Rotate key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
