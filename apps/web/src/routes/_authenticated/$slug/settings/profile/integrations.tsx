/**
 * Profile Settings Page - Integrations
 *
 * User integrations including API keys and connected applications
 * Route: /{slug}/settings/profile/integrations
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Doc } from "@seal/backend/convex/_generated/dataModel";
import type { ApiKeyScope } from "@seal/backend/convex/schema";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	Activity,
	AlertTriangle,
	Check,
	Clock,
	Copy,
	Eye,
	EyeOff,
	Key,
	Link2,
	Plus,
	RefreshCw,
	Trash2,
	Unplug,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/profile/integrations",
)({
	component: IntegrationsSettings,
	pendingComponent: FormSkeleton,
});

const AVAILABLE_SCOPES: {
	value: ApiKeyScope;
	label: string;
	description: string;
}[] = [
	{
		value: "documents:read",
		label: "Read Documents",
		description: "View documents and their metadata",
	},
	{
		value: "documents:write",
		label: "Write Documents",
		description: "Create and modify documents",
	},
	{
		value: "templates:read",
		label: "Read Templates",
		description: "View templates",
	},
	{
		value: "templates:write",
		label: "Write Templates",
		description: "Create and modify templates",
	},
	{
		value: "recipients:read",
		label: "Read Recipients",
		description: "View recipient information",
	},
	{
		value: "recipients:write",
		label: "Write Recipients",
		description: "Add and modify recipients",
	},
	{
		value: "signatures:read",
		label: "Read Signatures",
		description: "View signature data",
	},
];

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return formatDate(timestamp);
}

function IntegrationsSettings() {
	const apiKeys = useQuery(api.api_keys.queries.listApiKeys);
	const connectedApps = useQuery(api.api_keys.queries.listConnectedApps);
	const activityLogs = useQuery(api.api_keys.queries.listIntegrationActivity);

	if (!apiKeys || !connectedApps || !activityLogs) {
		return <FormSkeleton />;
	}

	return (
		<div className="space-y-6">
			{/* API Keys Section */}
			<ApiKeysSection apiKeys={apiKeys} />

			{/* Connected Apps Section */}
			<ConnectedAppsSection apps={connectedApps} />

			{/* Activity Logs Section */}
			<ActivityLogsSection logs={activityLogs} />
		</div>
	);
}

interface ApiKeyData {
	_id: Doc<"api_keys">["_id"];
	name: string;
	keyPrefix: string;
	scopes: ApiKeyScope[];
	expiresAt?: number;
	lastUsedAt?: number;
	revoked: boolean;
	createdAt: number;
}

function ApiKeysSection({ apiKeys }: { apiKeys: ApiKeyData[] }) {
	const [isCreating, setIsCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([]);
	const [newKey, setNewKey] = useState<string | null>(null);
	const [copiedKey, setCopiedKey] = useState(false);

	const createApiKey = useMutation(api.api_keys.mutations.createApiKey);
	const revokeApiKey = useMutation(api.api_keys.mutations.revokeApiKey);
	const deleteApiKey = useMutation(api.api_keys.mutations.deleteApiKey);

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
			setNewKey(result.key);
			toast.success("API key created successfully");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create API key",
			);
		}
	};

	const handleCopyKey = async () => {
		if (newKey) {
			await navigator.clipboard.writeText(newKey);
			setCopiedKey(true);
			setTimeout(() => setCopiedKey(false), 2000);
			toast.success("API key copied to clipboard");
		}
	};

	const handleCloseDialog = () => {
		setIsCreating(false);
		setNewKeyName("");
		setSelectedScopes([]);
		setNewKey(null);
		setCopiedKey(false);
	};

	const handleRevokeKey = async (keyId: Doc<"api_keys">["_id"]) => {
		try {
			await revokeApiKey({ keyId });
			toast.success("API key revoked");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke API key",
			);
		}
	};

	const handleDeleteKey = async (keyId: Doc<"api_keys">["_id"]) => {
		try {
			await deleteApiKey({ keyId });
			toast.success("API key deleted");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete API key",
			);
		}
	};

	const toggleScope = (scope: ApiKeyScope) => {
		setSelectedScopes((prev) =>
			prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
		);
	};

	const activeKeys = apiKeys.filter((k) => !k.revoked);
	const revokedKeys = apiKeys.filter((k) => k.revoked);

	return (
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
									{newKey ? "API Key Created" : "Create API Key"}
								</DialogTitle>
								<DialogDescription>
									{newKey
										? "Copy your API key now. You won't be able to see it again."
										: "Generate a new API key for programmatic access."}
								</DialogDescription>
							</DialogHeader>

							{newKey ? (
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Input
											value={newKey}
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
											Make sure to copy your API key now. You won't be able to
											see it again!
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
										<div className="space-y-2 rounded-lg border p-3">
											{AVAILABLE_SCOPES.map((scope) => (
												<div
													key={scope.value}
													className="flex items-start gap-3"
												>
													<Checkbox
														id={scope.value}
														checked={selectedScopes.includes(scope.value)}
														onCheckedChange={() => toggleScope(scope.value)}
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
					Manage API keys for programmatic access to your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				{activeKeys.length === 0 && revokedKeys.length === 0 ? (
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
						{activeKeys.map((key) => (
							<ApiKeyRow
								key={key._id}
								apiKey={key}
								onRevoke={() => handleRevokeKey(key._id)}
								onDelete={() => handleDeleteKey(key._id)}
							/>
						))}

						{revokedKeys.length > 0 && (
							<>
								<Separator />
								<p className="text-sm text-muted-foreground">Revoked Keys</p>
								{revokedKeys.map((key) => (
									<ApiKeyRow
										key={key._id}
										apiKey={key}
										onRevoke={() => handleRevokeKey(key._id)}
										onDelete={() => handleDeleteKey(key._id)}
									/>
								))}
							</>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ApiKeyRow({
	apiKey,
	onRevoke,
	onDelete,
}: {
	apiKey: ApiKeyData;
	onRevoke: () => void;
	onDelete: () => void;
}) {
	const [showPrefix, setShowPrefix] = useState(false);

	return (
		<div
			className={`flex items-center justify-between rounded-lg border p-4 ${apiKey.revoked ? "opacity-60" : ""}`}
		>
			<div className="space-y-1">
				<div className="flex items-center gap-2">
					<span className="font-medium">{apiKey.name}</span>
					{apiKey.revoked && (
						<Badge variant="destructive" className="text-xs">
							Revoked
						</Badge>
					)}
					{apiKey.expiresAt && apiKey.expiresAt < Date.now() && (
						<Badge variant="secondary" className="text-xs">
							Expired
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<button
						type="button"
						onClick={() => setShowPrefix(!showPrefix)}
						className="flex items-center gap-1 font-mono hover:text-foreground"
					>
						{showPrefix ? (
							<>
								<EyeOff className="h-3 w-3" />
								{apiKey.keyPrefix}...
							</>
						) : (
							<>
								<Eye className="h-3 w-3" />
								sk_live_****
							</>
						)}
					</button>
					<span>•</span>
					<span>Created {formatDate(apiKey.createdAt)}</span>
					{apiKey.lastUsedAt && (
						<>
							<span>•</span>
							<span>Last used {formatRelativeTime(apiKey.lastUsedAt)}</span>
						</>
					)}
				</div>
				<div className="flex flex-wrap gap-1 pt-1">
					{apiKey.scopes.map((scope) => (
						<Badge key={scope} variant="outline" className="text-xs">
							{scope}
						</Badge>
					))}
				</div>
			</div>
			<div className="flex items-center gap-2">
				{!apiKey.revoked && (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" size="sm">
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
				)}
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="ghost" size="icon">
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete API Key</AlertDialogTitle>
							<AlertDialogDescription>
								This will permanently delete this API key. This action cannot be
								undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={onDelete}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								Delete Key
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}

function ConnectedAppsSection({ apps }: { apps: Doc<"connected_apps">[] }) {
	const disconnectApp = useMutation(api.api_keys.mutations.disconnectApp);

	const handleDisconnect = async (appId: Doc<"connected_apps">["_id"]) => {
		try {
			await disconnectApp({ appId });
			toast.success("App disconnected");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to disconnect app",
			);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Link2 className="h-5 w-5" />
					<CardTitle>Connected Apps</CardTitle>
				</div>
				<CardDescription>
					Third-party applications connected to your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				{apps.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Unplug className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-sm text-muted-foreground">
							No connected apps
						</p>
						<p className="text-xs text-muted-foreground">
							Apps you authorize will appear here
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{apps.map((app) => (
							<div
								key={app._id}
								className="flex items-center justify-between rounded-lg border p-4"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="font-medium">{app.appName}</span>
										{app.active ? (
											<Badge variant="default" className="text-xs">
												Active
											</Badge>
										) : (
											<Badge variant="secondary" className="text-xs">
												Inactive
											</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground">
										Connected {formatDate(app.connectedAt)}
										{app.lastActivityAt && (
											<>
												{" "}
												• Last active {formatRelativeTime(app.lastActivityAt)}
											</>
										)}
									</p>
									<div className="flex flex-wrap gap-1 pt-1">
										{app.scopes.map((scope) => (
											<Badge key={scope} variant="outline" className="text-xs">
												{scope}
											</Badge>
										))}
									</div>
								</div>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="outline" size="sm">
											<Unplug className="mr-1 h-3 w-3" />
											Disconnect
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Disconnect {app.appName}
											</AlertDialogTitle>
											<AlertDialogDescription>
												This will revoke {app.appName}'s access to your account.
												The app will no longer be able to access your data.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => handleDisconnect(app._id)}
											>
												Disconnect
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ActivityLogsSection({
	logs,
}: {
	logs: Doc<"integration_activity_logs">[];
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Activity className="h-5 w-5" />
					<CardTitle>Activity Log</CardTitle>
				</div>
				<CardDescription>
					Recent integration activity on your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				{logs.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Clock className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-sm text-muted-foreground">
							No activity yet
						</p>
						<p className="text-xs text-muted-foreground">
							Integration activity will appear here
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{logs.map((log) => (
							<div
								key={log._id}
								className="flex items-start justify-between border-b pb-3 last:border-0"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Badge
											variant={log.type === "api_key" ? "default" : "secondary"}
											className="text-xs"
										>
											{log.type === "api_key" ? "API Key" : "Connected App"}
										</Badge>
										<span className="font-medium">{log.integrationName}</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{log.action}
										{log.details && ` - ${log.details}`}
									</p>
								</div>
								<span className="text-xs text-muted-foreground whitespace-nowrap">
									{formatRelativeTime(log.createdAt)}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
