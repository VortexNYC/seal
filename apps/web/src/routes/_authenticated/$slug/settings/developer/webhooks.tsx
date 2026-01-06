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
	RefreshCw,
	Send,
	Trash2,
	Webhook,
	XCircle,
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
		return <FormSkeleton />;
	}

	return (
		<PageWrapper
			title="Webhooks"
			description="Receive real-time notifications when events happen in Seal"
		>
			<div className="space-y-6">
				{/* Webhook Endpoints */}
				<WebhookEndpointsSection
					endpoints={endpoints}
					eventTypes={eventTypes}
				/>

				{/* Event Types Reference */}
				<EventTypesReference eventTypes={eventTypes} />

				{/* Documentation */}
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
						<Webhook className="h-5 w-5" />
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
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Webhook className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-sm text-muted-foreground">
							No webhook endpoints configured
						</p>
						<p className="text-xs text-muted-foreground">
							Create an endpoint to receive real-time event notifications
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{endpoints.map((endpoint) => (
							<WebhookEndpointRow key={endpoint._id} endpoint={endpoint} />
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

	// Group events by category
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
				<Button size="sm">
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
							<div className="flex items-center gap-2 mt-1.5">
								<Input
									value={newSecret}
									readOnly
									className="font-mono text-sm"
								/>
								<Button
									variant="outline"
									size="icon"
									onClick={handleCopySecret}
								>
									{copiedSecret ? (
										<Check className="h-4 w-4 text-green-600" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>
						<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
							<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
							<p className="text-sm text-amber-800 dark:text-amber-200">
								Store this secret securely. You'll need it to verify webhook
								signatures.
							</p>
						</div>
						<DialogFooter>
							<Button onClick={handleClose}>Done</Button>
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
							<Label>Events to subscribe</Label>
							<p className="text-xs text-muted-foreground mb-2">
								Leave empty to receive all events
							</p>
							<div className="rounded-lg border p-3 max-h-48 overflow-y-auto space-y-4">
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
														/>
														<Label
															htmlFor={event.type}
															className="font-normal text-sm cursor-pointer"
														>
															<code className="text-xs bg-muted px-1 py-0.5 rounded">
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

						<DialogFooter>
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={handleCreate}>Create Endpoint</Button>
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
		try {
			await testEndpoint({ endpointId: endpoint._id });
			toast.success("Test webhook sent");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send test",
			);
		}
	};

	const statusColors = {
		active: "bg-green-500",
		paused: "bg-yellow-500",
		disabled: "bg-red-500",
	};

	return (
		<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
			<div className="rounded-lg border">
				<div className="p-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="space-y-1 min-w-0 flex-1">
							<div className="flex items-center gap-2 flex-wrap">
								<CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground">
									{isExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
									<span className="font-medium">{endpoint.name}</span>
								</CollapsibleTrigger>
								<div
									className={`h-2 w-2 rounded-full ${statusColors[endpoint.status]}`}
								/>
								<Badge
									variant={
										endpoint.status === "active"
											? "default"
											: endpoint.status === "paused"
												? "secondary"
												: "destructive"
									}
									className="text-xs"
								>
									{endpoint.status}
								</Badge>
							</div>
							<div className="text-sm text-muted-foreground truncate">
								{endpoint.url}
							</div>
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<span>{endpoint.stats.successRate}% success rate</span>
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
								title="Send test webhook"
							>
								<Send className="h-4 w-4" />
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
										<Trash2 className="h-4 w-4 text-destructive" />
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
					<div className="p-4 space-y-4">
						{/* Secret */}
						<div className="space-y-2">
							<Label>Signing Secret</Label>
							<div className="flex items-center gap-2">
								<Input
									value={
										showSecret
											? `${endpoint.secretPrefix}...`
											: "whsec_••••••••"
									}
									readOnly
									className="font-mono text-sm"
								/>
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
											<AlertDialogAction onClick={handleRotateSecret}>
												Rotate Secret
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>

						{/* Subscribed Events */}
						<div className="space-y-2">
							<Label>Subscribed Events</Label>
							<div className="flex flex-wrap gap-1">
								{endpoint.events.length === 0 ? (
									<Badge variant="outline">All events</Badge>
								) : (
									endpoint.events.map((event) => (
										<Badge key={event} variant="outline" className="text-xs">
											{event}
										</Badge>
									))
								)}
							</div>
						</div>

						{/* Recent Deliveries */}
						<div className="space-y-2">
							<Label>Recent Deliveries</Label>
							{deliveries === undefined ? (
								<p className="text-sm text-muted-foreground">Loading...</p>
							) : deliveries.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No deliveries yet
								</p>
							) : (
								<div className="space-y-2 max-h-48 overflow-y-auto">
									{deliveries.map((delivery) => (
										<DeliveryRow key={delivery._id} delivery={delivery} />
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
}

function DeliveryRow({ delivery }: DeliveryRowProps) {
	const statusIcons = {
		pending: <Clock className="h-4 w-4 text-yellow-500" />,
		delivered: <Check className="h-4 w-4 text-green-500" />,
		failed: <XCircle className="h-4 w-4 text-red-500" />,
		abandoned: <XCircle className="h-4 w-4 text-gray-500" />,
	};

	return (
		<div className="flex items-center justify-between text-sm rounded-md border p-2">
			<div className="flex items-center gap-2">
				{statusIcons[delivery.status]}
				<code className="text-xs bg-muted px-1 py-0.5 rounded">
					{delivery.eventType}
				</code>
			</div>
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				{delivery.responseCode && <span>{delivery.responseCode}</span>}
				{delivery.responseTimeMs && <span>{delivery.responseTimeMs}ms</span>}
				<span>{formatRelativeTime(delivery.createdAt)}</span>
			</div>
		</div>
	);
}

interface EventTypesReferenceProps {
	eventTypes: { type: string; category: string; description: string }[];
}

function EventTypesReference({ eventTypes }: EventTypesReferenceProps) {
	const [isOpen, setIsOpen] = useState(false);

	// Group by category
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
							<div>
								<CardTitle className="text-base">
									Event Types Reference
								</CardTitle>
								<CardDescription>
									All available webhook event types
								</CardDescription>
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
									<h4 className="font-medium mb-2">{category}</h4>
									<div className="space-y-2">
										{events.map((event) => (
											<div
												key={event.type}
												className="flex items-start justify-between text-sm"
											>
												<code className="bg-muted px-1.5 py-0.5 rounded text-xs">
													{event.type}
												</code>
												<span className="text-muted-foreground text-right ml-4">
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
				<CardTitle>Webhook Documentation</CardTitle>
				<CardDescription>
					Learn how to verify and handle webhook events
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border p-4">
					<h4 className="font-medium mb-2">Verifying Signatures</h4>
					<p className="text-sm text-muted-foreground mb-3">
						All webhooks are signed using HMAC-SHA256. Verify the signature to
						ensure authenticity:
					</p>
					<pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
						<code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  const signedPayload = \`\${timestamp}.\${payload}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`}</code>
					</pre>
				</div>

				<div className="rounded-lg border p-4">
					<h4 className="font-medium mb-2">Webhook Headers</h4>
					<div className="space-y-2 text-sm">
						<div className="flex justify-between">
							<code className="bg-muted px-1.5 py-0.5 rounded">
								X-Seal-Signature
							</code>
							<span className="text-muted-foreground">
								HMAC-SHA256 signature
							</span>
						</div>
						<div className="flex justify-between">
							<code className="bg-muted px-1.5 py-0.5 rounded">
								X-Seal-Timestamp
							</code>
							<span className="text-muted-foreground">
								Unix timestamp of request
							</span>
						</div>
						<div className="flex justify-between">
							<code className="bg-muted px-1.5 py-0.5 rounded">
								X-Seal-Event-Id
							</code>
							<span className="text-muted-foreground">
								Unique event identifier
							</span>
						</div>
						<div className="flex justify-between">
							<code className="bg-muted px-1.5 py-0.5 rounded">
								X-Seal-Event-Type
							</code>
							<span className="text-muted-foreground">Event type name</span>
						</div>
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
