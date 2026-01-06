/**
 * Developer Settings - Webhooks
 *
 * Manage webhook endpoints for receiving real-time event notifications.
 * Route: /{slug}/settings/developer/webhooks
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Doc } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Pause,
	Play,
	Plus,
	Radio,
	RefreshCw,
	Send,
	Trash2,
	Webhook,
	XCircle,
	Zap,
} from "lucide-react";
import { useState } from "react";
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
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/developer/webhooks",
)({
	component: WebhooksPage,
	pendingComponent: FormSkeleton,
});

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
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

type WebhookEndpointWithStats = Doc<"webhook_endpoints"> & {
	stats: {
		recentDeliveries: number;
		delivered: number;
		failed: number;
		successRate: number;
	};
};

function WebhooksPage() {
	const endpoints = useQuery(api.webhooks.queries.listEndpoints);
	const eventTypes = useQuery(api.webhooks.queries.getEventTypes);

	if (!endpoints || !eventTypes) {
		return (
			<PageWrapper
				title="Webhooks"
				description="Receive real-time notifications when events happen in Seal"
			>
				<FormSkeleton />
			</PageWrapper>
		);
	}

	return (
		<PageWrapper
			title="Webhooks"
			description="Receive real-time notifications when events happen in Seal"
		>
			<div className="space-y-6">
				<WebhookEndpointsSection
					endpoints={endpoints}
					eventTypes={eventTypes}
				/>

				<EventTypesReference eventTypes={eventTypes} />

				<WebhookDocumentation />
			</div>
		</PageWrapper>
	);
}

interface WebhookEndpointsSectionProps {
	endpoints: WebhookEndpointWithStats[];
	eventTypes: { type: string; category: string; description: string }[];
}

function WebhookEndpointsSection({
	endpoints,
	eventTypes,
}: WebhookEndpointsSectionProps) {
	const [isCreating, setIsCreating] = useState(false);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Radio className="h-5 w-5 text-purple-600 dark:text-purple-400" />
						<CardTitle>Webhook Endpoints</CardTitle>
					</div>
					<CreateWebhookDialog
						open={isCreating}
						onOpenChange={setIsCreating}
						eventTypes={eventTypes}
					/>
				</div>
				<CardDescription>
					Configure endpoints to receive webhook events
				</CardDescription>
			</CardHeader>
			<CardContent>
				{endpoints.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<div className="relative">
							<div className="flex h-20 w-20 items-center justify-center rounded-2xl border bg-muted">
								<Webhook className="h-10 w-10 text-muted-foreground" />
							</div>
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="h-32 w-32 rounded-full border border-purple-500/20 animate-[ping_2s_ease-in-out_infinite]" />
							</div>
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="h-24 w-24 rounded-full border border-purple-500/30 animate-[ping_2s_ease-in-out_infinite_0.5s]" />
							</div>
						</div>
						<p className="mt-8 font-mono">Connect your first endpoint</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Receive real-time event notifications in your application
						</p>
						<Button
							onClick={() => setIsCreating(true)}
							className="mt-6 bg-purple-600 text-white hover:bg-purple-500"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Endpoint
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{endpoints.map((endpoint, index) => (
							<div
								key={endpoint._id}
								style={{ animationDelay: `${index * 50}ms` }}
								className="animate-in fade-in slide-in-from-bottom-2"
							>
								<WebhookEndpointRow endpoint={endpoint} />
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

interface CreateWebhookDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventTypes: { type: string; category: string; description: string }[];
}

function CreateWebhookDialog({
	open,
	onOpenChange,
	eventTypes,
}: CreateWebhookDialogProps) {
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [description, setDescription] = useState("");
	const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
	const [newSecret, setNewSecret] = useState<string | null>(null);
	const [copiedSecret, setCopiedSecret] = useState(false);

	const createEndpoint = useMutation(api.webhooks.mutations.createEndpoint);

	const handleCreate = async () => {
		if (!name.trim()) {
			toast.error("Please enter a name");
			return;
		}

		if (!url.trim()) {
			toast.error("Please enter a URL");
			return;
		}

		try {
			const result = await createEndpoint({
				name: name.trim(),
				url: url.trim(),
				events: selectedEvents,
				description: description.trim() || undefined,
			});

			if (result.secret) {
				setNewSecret(result.secret);
				toast.success("Webhook endpoint created");
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create webhook",
			);
		}
	};

	const handleCopySecret = async () => {
		if (newSecret) {
			await navigator.clipboard.writeText(newSecret);
			setCopiedSecret(true);
			setTimeout(() => setCopiedSecret(false), 2000);
			toast.success("Secret copied to clipboard");
		}
	};

	const handleClose = () => {
		setName("");
		setUrl("");
		setDescription("");
		setSelectedEvents([]);
		setNewSecret(null);
		setCopiedSecret(false);
		onOpenChange(false);
	};

	const toggleEvent = (eventType: string) => {
		setSelectedEvents((prev) =>
			prev.includes(eventType)
				? prev.filter((e) => e !== eventType)
				: [...prev, eventType],
		);
	};

	const toggleCategory = (category: string) => {
		const categoryEvents = eventTypes
			.filter((e) => e.category === category)
			.map((e) => e.type);

		const allSelected = categoryEvents.every((e) => selectedEvents.includes(e));

		if (allSelected) {
			setSelectedEvents((prev) =>
				prev.filter((e) => !categoryEvents.includes(e)),
			);
		} else {
			setSelectedEvents((prev) => [...new Set([...prev, ...categoryEvents])]);
		}
	};

	const eventsByCategory = eventTypes.reduce(
		(acc, event) => {
			if (!acc[event.category]) {
				acc[event.category] = [];
			}
			acc[event.category].push(event);
			return acc;
		},
		{} as Record<string, typeof eventTypes>,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					size="sm"
					className="bg-purple-600 text-white hover:bg-purple-500"
				>
					<Plus className="mr-1 h-4 w-4" />
					Add Endpoint
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{newSecret ? "Webhook Created" : "Create Webhook Endpoint"}
					</DialogTitle>
					<DialogDescription>
						{newSecret
							? "Copy your signing secret now. You won't be able to see it again."
							: "Configure a new endpoint to receive webhook events."}
					</DialogDescription>
				</DialogHeader>

				{newSecret ? (
					<div className="space-y-4">
						<div>
							<Label>Signing Secret</Label>
							<div className="relative mt-1.5">
								<div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-500/10 blur" />
								<div className="relative flex items-center gap-2 rounded-lg border border-purple-500/30 bg-muted p-3">
									<Input
										value={newSecret}
										readOnly
										className="flex-1 border-0 bg-transparent font-mono text-sm text-purple-700 dark:text-purple-300 focus-visible:ring-0"
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleCopySecret}
										className="shrink-0"
									>
										{copiedSecret ? (
											<Check className="h-4 w-4 text-emerald-500" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
						</div>
						<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
							<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
							<div>
								<p className="font-medium text-amber-800 dark:text-amber-200">
									Store this secret securely
								</p>
								<p className="text-sm text-amber-700 dark:text-amber-200/70">
									You'll need it to verify webhook signatures.
								</p>
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={handleClose}
								className="bg-purple-600 text-white hover:bg-purple-500"
							>
								Done
							</Button>
						</DialogFooter>
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="webhook-name">Name</Label>
							<Input
								id="webhook-name"
								placeholder="e.g., Production Webhook"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="webhook-url">Endpoint URL</Label>
							<Input
								id="webhook-url"
								placeholder="https://example.com/webhooks/seal"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								className="font-mono"
							/>
							<p className="text-xs text-muted-foreground">
								Must be HTTPS for production use
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="webhook-description">
								Description (optional)
							</Label>
							<Textarea
								id="webhook-description"
								placeholder="What this webhook is used for..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={2}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Events to subscribe</Label>
								{selectedEvents.length > 0 && (
									<Badge
										variant="secondary"
										className="text-purple-600 dark:text-purple-400"
									>
										{selectedEvents.length} selected
									</Badge>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								Leave empty to receive all events
							</p>
							<div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto space-y-4">
								{Object.entries(eventsByCategory).map(([category, events]) => {
									const categorySelected = events.every((e) =>
										selectedEvents.includes(e.type),
									);
									const categoryPartial =
										!categorySelected &&
										events.some((e) => selectedEvents.includes(e.type));

									return (
										<div key={category}>
											<div className="flex items-center gap-2 mb-2">
												<Checkbox
													id={`category-${category}`}
													checked={categorySelected}
													ref={(el) => {
														if (el) {
															(el as HTMLButtonElement).dataset.state =
																categoryPartial ? "indeterminate" : undefined;
														}
													}}
													onCheckedChange={() => toggleCategory(category)}
													className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
												/>
												<Label
													htmlFor={`category-${category}`}
													className="font-medium cursor-pointer"
												>
													{category}
												</Label>
											</div>
											<div className="ml-6 space-y-1">
												{events.map((event) => (
													<div
														key={event.type}
														className="flex items-start gap-2"
													>
														<Checkbox
															id={event.type}
															checked={selectedEvents.includes(event.type)}
															onCheckedChange={() => toggleEvent(event.type)}
															className="mt-0.5 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
														/>
														<Label
															htmlFor={event.type}
															className="font-normal text-sm cursor-pointer"
														>
															<code className="font-mono text-xs bg-muted text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
																{event.type}
															</code>
														</Label>
													</div>
												))}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<DialogFooter className="gap-2">
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button
								onClick={handleCreate}
								className="bg-purple-600 text-white hover:bg-purple-500"
							>
								Create Endpoint
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface WebhookEndpointRowProps {
	endpoint: WebhookEndpointWithStats;
}

function WebhookEndpointRow({ endpoint }: WebhookEndpointRowProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [showSecret, setShowSecret] = useState(false);
	const [isTesting, setIsTesting] = useState(false);

	const updateEndpoint = useMutation(api.webhooks.mutations.updateEndpoint);
	const deleteEndpoint = useMutation(api.webhooks.mutations.deleteEndpoint);
	const rotateSecret = useMutation(api.webhooks.mutations.rotateSecret);
	const testEndpoint = useMutation(api.webhooks.mutations.testEndpoint);

	const deliveries = useQuery(
		api.webhooks.queries.listDeliveries,
		isExpanded ? { endpointId: endpoint._id, limit: 10 } : "skip",
	);

	const handleToggleStatus = async () => {
		const newStatus = endpoint.status === "active" ? "paused" : "active";
		try {
			await updateEndpoint({
				endpointId: endpoint._id,
				status: newStatus,
			});
			toast.success(
				newStatus === "active" ? "Webhook enabled" : "Webhook paused",
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update webhook",
			);
		}
	};

	const handleDelete = async () => {
		try {
			await deleteEndpoint({ endpointId: endpoint._id });
			toast.success("Webhook deleted");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete webhook",
			);
		}
	};

	const handleRotateSecret = async () => {
		try {
			const result = await rotateSecret({ endpointId: endpoint._id });
			if (result.secret) {
				await navigator.clipboard.writeText(result.secret);
				toast.success("New secret copied to clipboard");
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to rotate secret",
			);
		}
	};

	const handleTest = async () => {
		setIsTesting(true);
		try {
			await testEndpoint({ endpointId: endpoint._id });
			toast.success("Test webhook sent");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send test",
			);
		} finally {
			setIsTesting(false);
		}
	};

	const statusConfig = {
		active: {
			border: "border-l-purple-500",
			badge: "text-purple-600 dark:text-purple-400",
			dot: "bg-purple-500",
		},
		paused: {
			border: "border-l-amber-500",
			badge: "text-amber-600 dark:text-amber-400",
			dot: "bg-amber-500",
		},
		disabled: {
			border: "border-l-rose-500",
			badge: "text-rose-600 dark:text-rose-400",
			dot: "bg-rose-500",
		},
	};

	const config = statusConfig[endpoint.status];

	const urlParts = endpoint.url.match(/^(https?:\/\/)(.+)$/);
	const protocol = urlParts?.[1] || "";
	const urlPath = urlParts?.[2] || endpoint.url;

	return (
		<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
			<div className="group relative overflow-hidden rounded-lg border transition-all duration-200 hover:border-purple-500/30 hover:shadow-sm dark:hover:shadow-purple-500/5">
				<div
					className={`absolute left-0 top-0 bottom-0 w-1 ${config.border}`}
				/>

				<div className="p-4 pl-5">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="space-y-2 min-w-0 flex-1">
							<div className="flex items-center gap-3 flex-wrap">
								<CollapsibleTrigger className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
									<span className="font-medium">{endpoint.name}</span>
								</CollapsibleTrigger>
								<div className={`h-2 w-2 rounded-full ${config.dot}`} />
								<Badge variant="secondary" className={config.badge}>
									{endpoint.status}
								</Badge>
							</div>
							<div className="font-mono text-sm truncate">
								<span className="text-muted-foreground">{protocol}</span>
								<span>{urlPath}</span>
							</div>
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<span
									className={`font-mono font-medium ${
										endpoint.stats.successRate >= 90
											? "text-emerald-600 dark:text-emerald-400"
											: endpoint.stats.successRate >= 70
												? "text-amber-600 dark:text-amber-400"
												: "text-rose-600 dark:text-rose-400"
									}`}
								>
									{endpoint.stats.successRate}% success
								</span>
								<span>
									{endpoint.events.length === 0
										? "All events"
										: `${endpoint.events.length} events`}
								</span>
								{endpoint.lastSuccessAt && (
									<span>
										Last success {formatRelativeTime(endpoint.lastSuccessAt)}
									</span>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2 self-end sm:self-center">
							<Button
								variant="outline"
								size="sm"
								onClick={handleTest}
								disabled={isTesting}
								title="Send test webhook"
							>
								<Send
									className={`h-4 w-4 ${isTesting ? "animate-pulse" : ""}`}
								/>
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleToggleStatus}
								title={endpoint.status === "active" ? "Pause" : "Enable"}
							>
								{endpoint.status === "active" ? (
									<Pause className="h-4 w-4" />
								) : (
									<Play className="h-4 w-4" />
								)}
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="outline" size="sm" title="Delete">
										<Trash2 className="h-4 w-4" />
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Delete Webhook</AlertDialogTitle>
										<AlertDialogDescription>
											This will permanently delete this webhook endpoint and all
											its delivery history. This action cannot be undone.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={handleDelete}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											Delete
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				</div>

				<CollapsibleContent>
					<Separator />
					<div className="p-4 pl-5 space-y-6">
						<div className="space-y-2">
							<Label>Signing Secret</Label>
							<div className="flex items-center gap-2">
								<div className="flex-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
									<code
										className={`font-mono text-sm transition-all duration-300 ${
											showSecret
												? "text-purple-700 dark:text-purple-300"
												: "text-muted-foreground blur-sm"
										}`}
									>
										{showSecret
											? `${endpoint.secretPrefix}...`
											: "whsec_••••••••••••••••"}
									</code>
								</div>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setShowSecret(!showSecret)}
								>
									{showSecret ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</Button>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="outline" size="icon" title="Rotate secret">
											<RefreshCw className="h-4 w-4" />
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Rotate Secret</AlertDialogTitle>
											<AlertDialogDescription>
												This will generate a new signing secret. The old secret
												will be invalidated immediately. Make sure to update
												your integration.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={handleRotateSecret}
												className="bg-amber-600 text-white hover:bg-amber-500"
											>
												Rotate Secret
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>

						<div className="space-y-2">
							<Label>Subscribed Events</Label>
							<div className="flex flex-wrap gap-1.5">
								{endpoint.events.length === 0 ? (
									<Badge
										variant="outline"
										className="font-mono text-xs text-purple-700 dark:text-purple-300"
									>
										All events
									</Badge>
								) : (
									endpoint.events.map((event) => (
										<Badge
											key={event}
											variant="outline"
											className="font-mono text-xs"
										>
											{event}
										</Badge>
									))
								)}
							</div>
						</div>

						<div className="space-y-2">
							<Label>Recent Deliveries</Label>
							{deliveries === undefined ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-purple-500 rounded-full animate-spin" />
									Loading...
								</div>
							) : deliveries.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No deliveries yet
								</p>
							) : (
								<div className="space-y-2 max-h-64 overflow-y-auto pr-2">
									{deliveries.map((delivery, index) => (
										<DeliveryRow
											key={delivery._id}
											delivery={delivery}
											isLast={index === deliveries.length - 1}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

interface DeliveryRowProps {
	delivery: Doc<"webhook_deliveries">;
	isLast: boolean;
}

function DeliveryRow({ delivery, isLast }: DeliveryRowProps) {
	const statusConfig = {
		pending: {
			icon: <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
			bg: "bg-sky-500/10",
		},
		delivered: {
			icon: (
				<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
			),
			bg: "bg-emerald-500/10",
		},
		failed: {
			icon: <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
			bg: "bg-rose-500/10",
		},
		abandoned: {
			icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
			bg: "bg-muted",
		},
	};

	const config = statusConfig[delivery.status];

	const responseCodeColor =
		delivery.responseCode &&
		delivery.responseCode >= 200 &&
		delivery.responseCode < 300
			? "text-emerald-600 dark:text-emerald-400"
			: delivery.responseCode && delivery.responseCode >= 400
				? "text-rose-600 dark:text-rose-400"
				: "text-amber-600 dark:text-amber-400";

	return (
		<div className="relative flex items-start gap-3">
			{!isLast && (
				<div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
			)}
			<div
				className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg}`}
			>
				{config.icon}
			</div>
			<div className="flex-1 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
				<div className="flex items-center gap-2">
					<code className="font-mono text-xs bg-muted text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
						{delivery.eventType}
					</code>
				</div>
				<div className="flex items-center gap-3 text-xs text-muted-foreground">
					{delivery.responseCode && (
						<span className={`font-mono font-medium ${responseCodeColor}`}>
							{delivery.responseCode}
						</span>
					)}
					{delivery.responseTimeMs && (
						<span className="font-mono">{delivery.responseTimeMs}ms</span>
					)}
					<span>{formatRelativeTime(delivery.createdAt)}</span>
				</div>
			</div>
		</div>
	);
}

interface EventTypesReferenceProps {
	eventTypes: { type: string; category: string; description: string }[];
}

function EventTypesReference({ eventTypes }: EventTypesReferenceProps) {
	const [isOpen, setIsOpen] = useState(false);

	const eventsByCategory = eventTypes.reduce(
		(acc, event) => {
			if (!acc[event.category]) {
				acc[event.category] = [];
			}
			acc[event.category].push(event);
			return acc;
		},
		{} as Record<string, typeof eventTypes>,
	);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<Card>
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
								<div>
									<CardTitle className="text-base">
										Event Types Reference
									</CardTitle>
									<CardDescription>
										All available webhook event types
									</CardDescription>
								</div>
							</div>
							{isOpen ? (
								<ChevronDown className="h-5 w-5 text-muted-foreground" />
							) : (
								<ChevronRight className="h-5 w-5 text-muted-foreground" />
							)}
						</div>
					</CardHeader>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<CardContent className="pt-0">
						<div className="space-y-6">
							{Object.entries(eventsByCategory).map(([category, events]) => (
								<div key={category}>
									<h4 className="font-medium mb-3">{category}</h4>
									<div className="space-y-2">
										{events.map((event) => (
											<div
												key={event.type}
												className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2"
											>
												<code className="font-mono text-xs bg-muted text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded shrink-0">
													{event.type}
												</code>
												<span className="text-sm text-muted-foreground text-right">
													{event.description}
												</span>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}

function WebhookDocumentation() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
					<CardTitle>Webhook Documentation</CardTitle>
				</div>
				<CardDescription>
					Learn how to verify and handle webhook events
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="relative overflow-hidden rounded-lg border bg-muted">
					<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
						<div className="h-3 w-3 rounded-full bg-red-500/80" />
						<div className="h-3 w-3 rounded-full bg-yellow-500/80" />
						<div className="h-3 w-3 rounded-full bg-green-500/80" />
						<span className="ml-2 font-mono text-xs text-muted-foreground">
							verify-signature.js
						</span>
					</div>
					<div className="p-4">
						<pre className="overflow-x-auto font-mono text-sm">
							<code>
								<span className="text-purple-600 dark:text-purple-400">
									const
								</span>
								<span> crypto = </span>
								<span className="text-cyan-600 dark:text-cyan-400">
									require
								</span>
								<span>(</span>
								<span className="text-emerald-600 dark:text-emerald-400">
									'crypto'
								</span>
								<span>);</span>
								{"\n\n"}
								<span className="text-purple-600 dark:text-purple-400">
									function
								</span>
								<span className="text-cyan-600 dark:text-cyan-400">
									{" "}
									verifyWebhook
								</span>
								<span>(payload, signature, timestamp, secret) {"{"}</span>
								{"\n"}
								<span>{"  "}</span>
								<span className="text-purple-600 dark:text-purple-400">
									const
								</span>
								<span>
									{" "}
									signedPayload = `${"{"}timestamp{"}"}.${"{"}payload{"}"}`
								</span>
								<span>;</span>
								{"\n"}
								<span>{"  "}</span>
								<span className="text-purple-600 dark:text-purple-400">
									const
								</span>
								<span> expected = crypto</span>
								{"\n"}
								<span>{"    "}.createHmac(</span>
								<span className="text-emerald-600 dark:text-emerald-400">
									'sha256'
								</span>
								<span>, secret)</span>
								{"\n"}
								<span>{"    "}.update(signedPayload)</span>
								{"\n"}
								<span>{"    "}.digest(</span>
								<span className="text-emerald-600 dark:text-emerald-400">
									'hex'
								</span>
								<span>);</span>
								{"\n"}
								<span>{"  "}</span>
								<span className="text-purple-600 dark:text-purple-400">
									return
								</span>
								<span> crypto.timingSafeEqual(</span>
								{"\n"}
								<span>{"    "}Buffer.from(signature),</span>
								{"\n"}
								<span>{"    "}Buffer.from(expected)</span>
								{"\n"}
								<span>{"  "});</span>
								{"\n"}
								<span>{"}"}</span>
							</code>
						</pre>
					</div>
				</div>

				<div className="rounded-lg border bg-muted/30 p-4">
					<h4 className="font-medium mb-3">Webhook Headers</h4>
					<div className="space-y-2 text-sm">
						{[
							["X-Seal-Signature", "HMAC-SHA256 signature"],
							["X-Seal-Timestamp", "Unix timestamp of request"],
							["X-Seal-Event-Id", "Unique event identifier"],
							["X-Seal-Event-Type", "Event type name"],
						].map(([header, description]) => (
							<div
								key={header}
								className="flex justify-between items-center gap-4"
							>
								<code className="font-mono text-xs bg-muted text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
									{header}
								</code>
								<span className="text-muted-foreground">{description}</span>
							</div>
						))}
					</div>
				</div>

				<Button variant="outline" asChild>
					<a href="/docs/webhooks" target="_blank" rel="noopener noreferrer">
						<ExternalLink className="mr-2 h-4 w-4" />
						View Full Documentation
					</a>
				</Button>
			</CardContent>
		</Card>
	);
}
