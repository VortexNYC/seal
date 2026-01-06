/**
 * Developer Settings - API Keys
 *
 * Manage API keys for programmatic access using Clerk's API Keys feature.
 * Route: /{slug}/settings/developer/api-keys
 */

import { useClerk } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	Clock,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Key,
	Plus,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/developer/api-keys",
)({
	component: ApiKeysPage,
	pendingComponent: FormSkeleton,
});

/**
 * Available API scopes for Seal.
 * These should match the scopes configured in Clerk Dashboard.
 */
const AVAILABLE_SCOPES = [
	{
		value: "seal:documents:read",
		label: "Read Documents",
		description: "View documents and their metadata",
	},
	{
		value: "seal:documents:write",
		label: "Write Documents",
		description: "Create, update, and delete documents",
	},
	{
		value: "seal:templates:read",
		label: "Read Templates",
		description: "View templates and their fields",
	},
	{
		value: "seal:templates:write",
		label: "Write Templates",
		description: "Create, update, and delete templates",
	},
	{
		value: "seal:recipients:read",
		label: "Read Recipients",
		description: "View recipient information",
	},
	{
		value: "seal:recipients:write",
		label: "Write Recipients",
		description: "Add and modify document recipients",
	},
	{
		value: "seal:signatures:read",
		label: "Read Signatures",
		description: "View signature data and verification",
	},
	{
		value: "seal:webhooks:manage",
		label: "Manage Webhooks",
		description: "Configure webhook endpoints",
	},
];

interface ApiKey {
	id: string;
	name: string;
	createdAt: Date;
	lastUsedAt?: Date;
	expiration?: Date;
	scopes: string[];
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diff = now - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return formatDate(date);
}

function ApiKeysPage() {
	const clerk = useClerk();

	const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
	const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
	const [copiedKey, setCopiedKey] = useState(false);

	/**
	 * Fetches API keys from Clerk.
	 * Uses organization keys if in an org context, otherwise user keys.
	 *
	 * Note: Clerk API Keys is in public beta. The SDK types may not be fully complete.
	 */
	const fetchApiKeys = useCallback(async () => {
		setIsLoading(true);
		try {
			// Clerk's apiKeys API - types may be incomplete in beta
			const apiKeysManager = clerk.apiKeys;
			if (!apiKeysManager) {
				setApiKeys([]);
				return;
			}

			const response = await apiKeysManager.getAll();
			// Response is ClerkPaginatedResponse, data is in response.data
			const keys = (response as { data?: unknown[] })?.data;

			if (Array.isArray(keys)) {
				const typedKeys = keys as Record<string, unknown>[];
				setApiKeys(
					typedKeys.map((key) => ({
						id: String(key.id || ""),
						name: String(key.name || ""),
						createdAt: new Date(key.createdAt as string | number),
						lastUsedAt: key.lastUsedAt
							? new Date(key.lastUsedAt as string | number)
							: undefined,
						expiration: key.expiration
							? new Date(key.expiration as string | number)
							: undefined,
						scopes: Array.isArray(key.scopes) ? (key.scopes as string[]) : [],
					})),
				);
			} else {
				setApiKeys([]);
			}
		} catch (error) {
			console.error("Failed to fetch API keys:", error);
			// If Clerk API keys aren't available yet, show empty state
			setApiKeys([]);
		} finally {
			setIsLoading(false);
		}
	}, [clerk]);

	useEffect(() => {
		fetchApiKeys();
	}, [fetchApiKeys]);

	const handleCreateKey = async () => {
		if (!newKeyName.trim()) {
			toast.error("Please enter a name for the API key");
			return;
		}

		if (selectedScopes.length === 0) {
			toast.error("Please select at least one scope");
			return;
		}

		try {
			const apiKeysManager = clerk.apiKeys;
			if (!apiKeysManager) {
				toast.error("API Keys feature is not available");
				return;
			}

			// Note: Clerk API Keys is in beta, types may not include scopes yet
			const result = await apiKeysManager.create({
				name: newKeyName.trim(),
				// scopes may not be supported yet in the SDK
			} as Parameters<typeof apiKeysManager.create>[0]);

			if (result) {
				// The secret is returned on the result object
				const secret = (result as { secret?: string }).secret;
				if (secret) {
					setNewKeySecret(secret);
				}
				toast.success("API key created successfully");
				await fetchApiKeys();
			}
		} catch (error) {
			console.error("Failed to create API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to create API key",
			);
		}
	};

	const handleCopyKey = async () => {
		if (newKeySecret) {
			await navigator.clipboard.writeText(newKeySecret);
			setCopiedKey(true);
			setTimeout(() => setCopiedKey(false), 2000);
			toast.success("API key copied to clipboard");
		}
	};

	const handleCloseDialog = () => {
		setIsCreating(false);
		setNewKeyName("");
		setSelectedScopes([]);
		setNewKeySecret(null);
		setCopiedKey(false);
	};

	const handleRevokeKey = async (keyId: string) => {
		try {
			await clerk.apiKeys?.revoke({ apiKeyID: keyId });
			toast.success("API key revoked");
			await fetchApiKeys();
		} catch (error) {
			console.error("Failed to revoke API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke API key",
			);
		}
	};

	const toggleScope = (scope: string) => {
		setSelectedScopes((prev) =>
			prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
		);
	};

	if (isLoading) {
		return (
			<PageWrapper
				title="API Keys"
				description="Manage API keys for programmatic access to Seal"
			>
				<FormSkeleton />
			</PageWrapper>
		);
	}

	// Check if Clerk API Keys feature is available
	const isApiKeysAvailable = !!clerk.apiKeys;

	return (
		<PageWrapper
			title="API Keys"
			description="Manage API keys for programmatic access to Seal"
		>
			<div className="space-y-6">
				{!isApiKeysAvailable ? (
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Key className="h-5 w-5" />
								<CardTitle>API Keys</CardTitle>
							</div>
							<CardDescription>
								API keys allow you to access the Seal API programmatically
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<AlertTriangle className="h-12 w-12 text-amber-500" />
								<p className="mt-4 text-sm font-medium">
									API Keys feature is being set up
								</p>
								<p className="mt-2 text-sm text-muted-foreground max-w-md">
									The API Keys feature requires configuration in the Clerk
									Dashboard. Please enable API Keys in your Clerk application
									settings.
								</p>
								<Button variant="outline" className="mt-4" asChild>
									<a
										href="https://dashboard.clerk.com"
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										Open Clerk Dashboard
									</a>
								</Button>
							</div>
						</CardContent>
					</Card>
				) : (
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Key className="h-5 w-5" />
									<CardTitle>API Keys</CardTitle>
								</div>
								<Dialog
									open={isCreating}
									onOpenChange={(open) => {
										if (!open) handleCloseDialog();
										else setIsCreating(true);
									}}
								>
									<DialogTrigger asChild>
										<Button size="sm">
											<Plus className="mr-1 h-4 w-4" />
											Create API Key
										</Button>
									</DialogTrigger>
									<DialogContent className="sm:max-w-md">
										<DialogHeader>
											<DialogTitle>
												{newKeySecret ? "API Key Created" : "Create API Key"}
											</DialogTitle>
											<DialogDescription>
												{newKeySecret
													? "Copy your API key now. You won't be able to see it again."
													: "Generate a new API key for programmatic access."}
											</DialogDescription>
										</DialogHeader>

										{newKeySecret ? (
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Input
														value={newKeySecret}
														readOnly
														className="font-mono text-sm"
													/>
													<Button
														variant="outline"
														size="icon"
														onClick={handleCopyKey}
													>
														{copiedKey ? (
															<Check className="h-4 w-4 text-green-600" />
														) : (
															<Copy className="h-4 w-4" />
														)}
													</Button>
												</div>
												<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
													<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
													<p className="text-sm text-amber-800 dark:text-amber-200">
														Make sure to copy your API key now. You won't be
														able to see it again!
													</p>
												</div>
												<DialogFooter>
													<Button onClick={handleCloseDialog}>Done</Button>
												</DialogFooter>
											</div>
										) : (
											<div className="space-y-4">
												<div className="space-y-2">
													<Label htmlFor="key-name">Name</Label>
													<Input
														id="key-name"
														placeholder="e.g., Production API Key"
														value={newKeyName}
														onChange={(e) => setNewKeyName(e.target.value)}
													/>
												</div>

												<div className="space-y-2">
													<Label>Permissions</Label>
													<div className="space-y-2 rounded-lg border p-3 max-h-64 overflow-y-auto">
														{AVAILABLE_SCOPES.map((scope) => (
															<div
																key={scope.value}
																className="flex items-start gap-3"
															>
																<Checkbox
																	id={scope.value}
																	checked={selectedScopes.includes(scope.value)}
																	onCheckedChange={() =>
																		toggleScope(scope.value)
																	}
																/>
																<div className="grid gap-0.5">
																	<Label
																		htmlFor={scope.value}
																		className="font-normal cursor-pointer"
																	>
																		{scope.label}
																	</Label>
																	<p className="text-xs text-muted-foreground">
																		{scope.description}
																	</p>
																</div>
															</div>
														))}
													</div>
												</div>

												<DialogFooter>
													<Button variant="outline" onClick={handleCloseDialog}>
														Cancel
													</Button>
													<Button onClick={handleCreateKey}>Create Key</Button>
												</DialogFooter>
											</div>
										)}
									</DialogContent>
								</Dialog>
							</div>
							<CardDescription>
								API keys allow secure programmatic access to the Seal API
							</CardDescription>
						</CardHeader>
						<CardContent>
							{apiKeys.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<Key className="h-12 w-12 text-muted-foreground/50" />
									<p className="mt-4 text-sm text-muted-foreground">
										No API keys yet
									</p>
									<p className="text-xs text-muted-foreground">
										Create an API key to access the Seal API programmatically
									</p>
								</div>
							) : (
								<div className="space-y-4">
									{apiKeys.map((key) => (
										<ApiKeyRow
											key={key.id}
											apiKey={key}
											onRevoke={() => handleRevokeKey(key.id)}
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* API Documentation Card */}
				<Card>
					<CardHeader>
						<CardTitle>API Documentation</CardTitle>
						<CardDescription>
							Learn how to use the Seal API to automate document workflows
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="rounded-lg border p-4">
								<h4 className="font-medium mb-2">Quick Start</h4>
								<p className="text-sm text-muted-foreground mb-3">
									Use your API key in the Authorization header:
								</p>
								<pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
									<code>{`curl -X GET "https://api.seal.app/v1/documents" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
								</pre>
							</div>

							<div className="flex items-center gap-4">
								<Button variant="outline" asChild>
									<a href="/docs/api" target="_blank" rel="noopener noreferrer">
										<ExternalLink className="mr-2 h-4 w-4" />
										View API Docs
									</a>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}

interface ApiKeyRowProps {
	apiKey: ApiKey;
	onRevoke: () => void;
}

function ApiKeyRow({ apiKey, onRevoke }: ApiKeyRowProps) {
	const [showId, setShowId] = useState(false);
	const isExpired = apiKey.expiration && apiKey.expiration < new Date();

	return (
		<div
			className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 gap-4 ${isExpired ? "opacity-60" : ""}`}
		>
			<div className="space-y-1 min-w-0 flex-1">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="font-medium truncate">{apiKey.name}</span>
					{isExpired && (
						<Badge variant="secondary" className="text-xs">
							Expired
						</Badge>
					)}
				</div>
				<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
					<button
						type="button"
						onClick={() => setShowId(!showId)}
						className="flex items-center gap-1 font-mono hover:text-foreground min-h-[44px] sm:min-h-0"
					>
						{showId ? (
							<>
								<EyeOff className="h-3 w-3" />
								{apiKey.id.slice(0, 12)}...
							</>
						) : (
							<>
								<Eye className="h-3 w-3" />
								sk_****
							</>
						)}
					</button>
					<span className="hidden sm:inline">•</span>
					<span>Created {formatDate(apiKey.createdAt)}</span>
					{apiKey.lastUsedAt && (
						<>
							<span className="hidden sm:inline">•</span>
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								Last used {formatRelativeTime(apiKey.lastUsedAt)}
							</span>
						</>
					)}
				</div>
				{apiKey.scopes.length > 0 && (
					<div className="flex flex-wrap gap-1 pt-1">
						{apiKey.scopes.map((scope) => (
							<Badge key={scope} variant="outline" className="text-xs">
								{scope.replace("seal:", "")}
							</Badge>
						))}
					</div>
				)}
			</div>
			<div className="flex items-center gap-2 self-end sm:self-center">
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="min-h-[44px] sm:min-h-0"
						>
							<RefreshCw className="mr-1 h-3 w-3" />
							Revoke
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Revoke API Key</AlertDialogTitle>
							<AlertDialogDescription>
								This will immediately revoke access for this API key. Any
								applications using this key will stop working.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={onRevoke}>
								Revoke Key
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
