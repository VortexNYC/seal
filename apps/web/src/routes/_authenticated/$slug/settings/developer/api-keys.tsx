/**
 * Developer Settings - API Keys
 *
 * Manage API keys for programmatic access using Clerk's API Keys feature.
 * Route: /{slug}/settings/developer/api-keys
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import {
	AlertTriangle,
	Check,
	Clock,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	Key,
	Lock,
	Pencil,
	Plus,
	RefreshCw,
	Shield,
	Users,
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

type ClerkApiScope =
	| "seal:documents:read"
	| "seal:documents:write"
	| "seal:templates:read"
	| "seal:templates:write"
	| "seal:recipients:read"
	| "seal:recipients:write"
	| "seal:signatures:read";

const AVAILABLE_SCOPES: {
	value: ClerkApiScope;
	label: string;
	description: string;
	icon: typeof FileText;
}[] = [
	{
		value: "seal:documents:read",
		label: "Read Documents",
		description: "View documents and their metadata",
		icon: FileText,
	},
	{
		value: "seal:documents:write",
		label: "Write Documents",
		description: "Create, update, and delete documents",
		icon: Pencil,
	},
	{
		value: "seal:templates:read",
		label: "Read Templates",
		description: "View templates and their fields",
		icon: FileText,
	},
	{
		value: "seal:templates:write",
		label: "Write Templates",
		description: "Create, update, and delete templates",
		icon: Pencil,
	},
	{
		value: "seal:recipients:read",
		label: "Read Recipients",
		description: "View recipient information",
		icon: Users,
	},
	{
		value: "seal:recipients:write",
		label: "Write Recipients",
		description: "Add and modify document recipients",
		icon: Users,
	},
	{
		value: "seal:signatures:read",
		label: "Read Signatures",
		description: "View signature data and verification",
		icon: Shield,
	},
];

interface ApiKey {
	id: string;
	name: string;
	createdAt: Date;
	lastUsedAt?: Date;
	scopes: string[];
	revoked: boolean;
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
	const createApiKey = useAction(api.api_keys.actions.createClerkApiKey);
	const listApiKeys = useAction(api.api_keys.actions.listClerkApiKeys);
	const revokeApiKey = useAction(api.api_keys.actions.revokeClerkApiKey);

	const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<ClerkApiScope[]>([]);
	const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
	const [copiedKey, setCopiedKey] = useState(false);

	const fetchApiKeys = useCallback(async () => {
		setIsLoading(true);
		try {
			const keys = await listApiKeys();
			setApiKeys(
				keys.map((key) => ({
					id: key.id,
					name: key.name,
					createdAt: new Date(key.createdAt),
					lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt) : undefined,
					scopes: key.scopes,
					revoked: key.revoked,
				})),
			);
		} catch (error) {
			console.error("Failed to fetch API keys:", error);
			setApiKeys([]);
		} finally {
			setIsLoading(false);
		}
	}, [listApiKeys]);

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
			const result = await createApiKey({
				name: newKeyName.trim(),
				scopes: selectedScopes,
			});

			if (result?.secret) {
				setNewKeySecret(result.secret);
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
			await revokeApiKey({ apiKeyId: keyId });
			toast.success("API key revoked");
			await fetchApiKeys();
		} catch (error) {
			console.error("Failed to revoke API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke API key",
			);
		}
	};

	const toggleScope = (scope: ClerkApiScope) => {
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

	const activeKeys = apiKeys.filter((key) => !key.revoked);

	return (
		<PageWrapper
			title="API Keys"
			description="Manage API keys for programmatic access to Seal"
		>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Key className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
								<CardTitle>Your API Keys</CardTitle>
							</div>
							<Dialog
								open={isCreating}
								onOpenChange={(open) => {
									if (!open) handleCloseDialog();
									else setIsCreating(true);
								}}
							>
								<DialogTrigger asChild>
									<Button
										size="sm"
										className="bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
									>
										<Plus className="mr-1 h-4 w-4" />
										Create API Key
									</Button>
								</DialogTrigger>
								<DialogContent className="sm:max-w-lg">
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
											<div className="relative">
												<div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 blur" />
												<div className="relative flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-muted p-3">
													<Input
														value={newKeySecret}
														readOnly
														className="flex-1 border-0 bg-transparent font-mono text-sm text-cyan-700 dark:text-cyan-300 focus-visible:ring-0"
													/>
													<Button
														variant="ghost"
														size="icon"
														onClick={handleCopyKey}
														className="shrink-0"
													>
														{copiedKey ? (
															<Check className="h-4 w-4 text-emerald-500" />
														) : (
															<Copy className="h-4 w-4" />
														)}
													</Button>
												</div>
											</div>
											<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
												<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
												<div>
													<p className="font-medium text-amber-800 dark:text-amber-200">
														Save this key securely
													</p>
													<p className="text-sm text-amber-700 dark:text-amber-200/70">
														This is the only time you'll see this key. Store it
														in a secure location.
													</p>
												</div>
											</div>
											<DialogFooter>
												<Button
													onClick={handleCloseDialog}
													className="bg-cyan-600 text-white hover:bg-cyan-500"
												>
													Done
												</Button>
											</DialogFooter>
										</div>
									) : (
										<div className="space-y-6">
											<div className="space-y-2">
												<Label htmlFor="key-name">Key Name</Label>
												<Input
													id="key-name"
													placeholder="e.g., Production API Key"
													value={newKeyName}
													onChange={(e) => setNewKeyName(e.target.value)}
												/>
											</div>

											<div className="space-y-3">
												<Label>Permissions</Label>
												<div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 max-h-64 overflow-y-auto">
													{AVAILABLE_SCOPES.map((scope) => {
														const IconComponent = scope.icon;
														const isSelected = selectedScopes.includes(
															scope.value,
														);
														return (
															<button
																key={scope.value}
																type="button"
																onClick={() => toggleScope(scope.value)}
																className={`group relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all ${
																	isSelected
																		? "border-cyan-500/50 bg-cyan-500/10"
																		: "border-border bg-background hover:border-cyan-500/30"
																}`}
															>
																<div className="flex items-center gap-2">
																	<div
																		className={`flex h-8 w-8 items-center justify-center rounded-md ${
																			isSelected
																				? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
																				: "bg-muted text-muted-foreground group-hover:text-foreground"
																		}`}
																	>
																		<IconComponent className="h-4 w-4" />
																	</div>
																	<Checkbox
																		checked={isSelected}
																		className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
																	/>
																</div>
																<div>
																	<p
																		className={`text-sm font-medium ${isSelected ? "text-cyan-700 dark:text-cyan-300" : ""}`}
																	>
																		{scope.label}
																	</p>
																	<p className="text-xs text-muted-foreground line-clamp-2">
																		{scope.description}
																	</p>
																</div>
															</button>
														);
													})}
												</div>
												<p className="text-xs text-muted-foreground">
													Selected: {selectedScopes.length} permission
													{selectedScopes.length !== 1 ? "s" : ""}
												</p>
											</div>

											<DialogFooter className="gap-2">
												<Button variant="outline" onClick={handleCloseDialog}>
													Cancel
												</Button>
												<Button
													onClick={handleCreateKey}
													className="bg-cyan-600 text-white hover:bg-cyan-500"
												>
													Create Key
												</Button>
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
						{activeKeys.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-16 text-center">
								<div className="relative">
									<div className="flex h-20 w-20 items-center justify-center rounded-2xl border bg-muted">
										<Key className="h-10 w-10 text-muted-foreground" />
									</div>
									<div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background bg-cyan-500 animate-pulse" />
								</div>
								<p className="mt-6 font-mono">No API keys configured</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Create an API key to access the Seal API programmatically
								</p>
								<Button
									onClick={() => setIsCreating(true)}
									className="mt-6 bg-cyan-600 text-white hover:bg-cyan-500"
								>
									<Plus className="mr-2 h-4 w-4" />
									Create your first API key
								</Button>
							</div>
						) : (
							<div className="space-y-3">
								{activeKeys.map((key, index) => (
									<div
										key={key.id}
										style={{ animationDelay: `${index * 50}ms` }}
										className="animate-in fade-in slide-in-from-bottom-2"
									>
										<ApiKeyRow
											apiKey={key}
											onRevoke={() => handleRevokeKey(key.id)}
										/>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<ExternalLink className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
							<CardTitle>API Documentation</CardTitle>
						</div>
						<CardDescription>
							Learn how to use the Seal API to automate document workflows
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="relative overflow-hidden rounded-lg border bg-muted">
								<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
									<div className="h-3 w-3 rounded-full bg-red-500/80" />
									<div className="h-3 w-3 rounded-full bg-yellow-500/80" />
									<div className="h-3 w-3 rounded-full bg-green-500/80" />
									<span className="ml-2 font-mono text-xs text-muted-foreground">
										terminal
									</span>
								</div>
								<div className="p-4">
									<pre className="overflow-x-auto font-mono text-sm">
										<code>
											<span className="text-cyan-600 dark:text-cyan-400">
												curl
											</span>
											<span className="text-foreground"> -X GET </span>
											<span className="text-emerald-600 dark:text-emerald-400">
												"https://api.seal.app/v1/documents"
											</span>
											<span className="text-foreground"> \</span>
											{"\n"}
											<span className="text-foreground">{"  "}-H </span>
											<span className="text-amber-600 dark:text-amber-400">
												"Authorization: Bearer YOUR_API_KEY"
											</span>
										</code>
									</pre>
								</div>
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

	return (
		<div className="group relative overflow-hidden rounded-lg border transition-all duration-200 hover:border-cyan-500/30 hover:shadow-sm dark:hover:shadow-cyan-500/5">
			<div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />

			<div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 pl-5 gap-4">
				<div className="space-y-2 min-w-0 flex-1">
					<div className="flex items-center gap-3 flex-wrap">
						<Lock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
						<span className="font-medium truncate">{apiKey.name}</span>
						<Badge
							variant="secondary"
							className="text-emerald-600 dark:text-emerald-400"
						>
							<span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							Active
						</Badge>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
						<button
							type="button"
							onClick={() => setShowId(!showId)}
							className="inline-flex items-center gap-1.5 font-mono text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
						>
							{showId ? (
								<>
									<EyeOff className="h-3.5 w-3.5" />
									<span className="text-cyan-600 dark:text-cyan-400">
										{apiKey.id.slice(0, 16)}...
									</span>
								</>
							) : (
								<>
									<Eye className="h-3.5 w-3.5" />
									<span>
										<span className="text-cyan-600/70 dark:text-cyan-400/70">
											&gt;
										</span>{" "}
										sk_****
									</span>
								</>
							)}
						</button>
						<span className="hidden sm:inline text-muted-foreground/50">•</span>
						<span className="text-muted-foreground">
							Created {formatDate(apiKey.createdAt)}
						</span>
						{apiKey.lastUsedAt && (
							<>
								<span className="hidden sm:inline text-muted-foreground/50">
									•
								</span>
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<Clock className="h-3 w-3" />
									Last used {formatRelativeTime(apiKey.lastUsedAt)}
								</span>
							</>
						)}
					</div>

					{apiKey.scopes.length > 0 && (
						<div className="flex flex-wrap gap-1.5 pt-1">
							{apiKey.scopes.map((scope) => (
								<Badge
									key={scope}
									variant="outline"
									className="font-mono text-xs"
								>
									{scope.replace("seal:", "")}
								</Badge>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2 self-end sm:self-center">
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" size="sm">
								<RefreshCw className="mr-1.5 h-3.5 w-3.5" />
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
								<AlertDialogAction
									onClick={onRevoke}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									Revoke Key
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</div>
	);
}
