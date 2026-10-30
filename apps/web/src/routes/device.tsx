import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SealLogo } from "@/components/seal-logo";

const API_URL: string = import.meta.env.VITE_API_URL;

interface DeviceSearch {
  user_code?: string;
}

export const Route = createFileRoute("/device")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): DeviceSearch => {
    const result: DeviceSearch = {};
    if (typeof search.user_code === "string") {
      result.user_code = search.user_code;
    }
    return result;
  },
});

type State =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "ready"; clientId: string | null; scope: string | null }
  | { kind: "done"; approved: boolean }
  | { kind: "error"; message: string };

function RouteComponent() {
  const { user_code: userCode } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!userCode) {
      setState({ kind: "error", message: "Missing user_code parameter." });
      return;
    }
    void fetch(
      `${API_URL}/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
      { credentials: "include" }
    ).then(async (res) => {
      if (res.status === 401) {
        setState({ kind: "unauthenticated" });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error_description?: string;
          message?: string;
        };
        setState({
          kind: "error",
          message:
            body.error_description ??
            body.message ??
            `Verification failed (${res.status}).`,
        });
        return;
      }
      const body = (await res.json()) as {
        client_id?: string;
        scope?: string;
      };
      setState({
        kind: "ready",
        clientId: body.client_id ?? null,
        scope: body.scope ?? null,
      });
    });
  }, [userCode]);

  async function decide(approve: boolean): Promise<void> {
    setState({ kind: "loading" });
    const res = await fetch(
      `${API_URL}/api/auth/device/${approve ? "approve" : "deny"}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userCode }),
      }
    );
    if (res.ok) {
      setState({ kind: "done", approved: approve });
      return;
    }
    const body = (await res.json().catch(() => ({}))) as {
      error_description?: string;
      message?: string;
    };
    setState({
      kind: "error",
      message:
        body.error_description ??
        body.message ??
        `Request failed (${res.status}).`,
    });
  }

  return (
    <div className="bg-kumo-base flex min-h-screen items-center justify-center p-6">
      <div className="bg-kumo-elevated border-kumo-line w-full max-w-md rounded-xl border p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <SealLogo size={32} variant="color" />
          <span className="font-serif text-2xl leading-none tracking-tight">
            Seal
          </span>
        </div>

        {state.kind === "loading" && (
          <Text as="p" size="sm">
            Checking device authorization…
          </Text>
        )}

        {state.kind === "unauthenticated" && (
          <>
            <Text as="h1" size="lg" variant="heading">
              Sign in required
            </Text>
            <Text as="p" size="sm" DANGEROUS_className="mt-2">
              You need to sign in before approving device
              {userCode ? ` code ${userCode}` : " access"}.
            </Text>
            <a
              className="text-kumo-link mt-4 inline-block text-sm underline"
              href={`/sign-in?redirect=${encodeURIComponent(
                `/device?user_code=${userCode ?? ""}`
              )}`}
            >
              Sign in to continue
            </a>
          </>
        )}

        {state.kind === "ready" && (
          <>
            <Text as="h1" size="lg" variant="heading">
              Authorize device
            </Text>
            <Text as="p" size="sm" DANGEROUS_className="mt-2">
              A device is requesting access to your Seal account.
            </Text>
            <dl className="text-kumo-default mt-4 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-kumo-subtle">Code</dt>
                <dd className="font-mono">{userCode}</dd>
              </div>
              {state.clientId && (
                <div className="flex gap-2">
                  <dt className="text-kumo-subtle">Client</dt>
                  <dd className="font-mono">{state.clientId}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => void decide(true)}>
                Approve
              </Button>
              <Button variant="outline" onClick={() => void decide(false)}>
                Deny
              </Button>
            </div>
          </>
        )}

        {state.kind === "done" && (
          <>
            <Text as="h1" size="lg" variant="heading">
              {state.approved ? "Device approved" : "Device denied"}
            </Text>
            <Text as="p" size="sm" DANGEROUS_className="mt-2">
              You can close this tab and return to the CLI.
            </Text>
          </>
        )}

        {state.kind === "error" && (
          <>
            <Text as="h1" size="lg" variant="heading">
              Something went wrong
            </Text>
            <Text as="p" size="sm" DANGEROUS_className="mt-2">
              {state.message}
            </Text>
          </>
        )}
      </div>
    </div>
  );
}
