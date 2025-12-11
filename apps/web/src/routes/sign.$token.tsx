/**
 * Public Signing Page
 * Route: /sign/$token
 *
 * Allows recipients to view and sign documents using their unique signing token.
 * This is an unauthenticated route - no Clerk login required.
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckCircle2Icon,
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClockIcon,
	DownloadIcon,
	FileTextIcon,
	PenLineIcon,
	PlayCircleIcon,
	ShieldCheckIcon,
	UserIcon,
	WifiOffIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import { FieldInputManager } from "@/components/documents/field-input-manager";
import { FillableFieldOverlay } from "@/components/documents/fillable-field-overlay";
import { SignatureCapture } from "@/components/documents/signature-capture";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute("/sign/$token")({
	component: SigningPage,
});

// Helper to capitalize field labels for display
const capitalizeFieldLabel = (label: string): string => {
	// If label is already capitalized, return as-is
	if (label && label[0] === label[0].toUpperCase()) {
		return label;
	}
	// Otherwise, capitalize first letter of each word
	return label
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

function SigningPage() {
	const { token } = Route.useParams();
	const { convexClient } = useRouteContext({ from: "__root__" });

	// Fetch recipient and document data using the signing token
	const { data } = useSuspenseQuery(
		convexQuery(api.documents.recipients_queries.getRecipientByToken, {
			signingToken: token,
		}),
	);

	const { recipient, document: doc } = data;

	// Fetch fields assigned to this recipient
	const { data: fields = [], refetch: refetchFields } = useSuspenseQuery(
		convexQuery(api.signature_fields.queries.getFieldsBySigningToken, {
			signingToken: token,
		}),
	);

	// PDF viewer state
	const [numPages, setNumPages] = useState<number | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [pdfPageDimensions, setPdfPageDimensions] = useState<
		Map<number, { width: number; height: number }>
	>(new Map());

	// Field input state
	const [activeFieldId, setActiveFieldId] =
		useState<Id<"signature_fields"> | null>(null);
	const [showFieldInput, setShowFieldInput] = useState(false);

	// Signature capture state
	const [showSignatureCapture, setShowSignatureCapture] = useState(false);
	const [showDeclineDialog, setShowDeclineDialog] = useState(false);
	const [declineReason, setDeclineReason] = useState("");

	// Field navigation state
	const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
	const pdfContainerRef = useRef<HTMLDivElement>(null);
	const fieldRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	// Responsive PDF width
	const [pdfWidth, setPdfWidth] = useState(700);

	// Network status for session recovery
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);

	// Track online/offline status
	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			toast.success("Connection restored");
		};
		const handleOffline = () => {
			setIsOnline(false);
			toast.error("Connection lost. Your progress is saved.");
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// Update PDF width based on container size
	useEffect(() => {
		const updatePdfWidth = () => {
			if (pdfContainerRef.current) {
				const containerWidth = pdfContainerRef.current.clientWidth;
				// Leave some padding (32px total for p-4)
				const availableWidth = containerWidth - 32;
				// Cap at 700px max, min at 280px for mobile
				setPdfWidth(Math.max(280, Math.min(700, availableWidth)));
			}
		};

		// Initial calculation after mount
		const timer = setTimeout(updatePdfWidth, 100);

		// Update on resize
		window.addEventListener("resize", updatePdfWidth);

		return () => {
			clearTimeout(timer);
			window.removeEventListener("resize", updatePdfWidth);
		};
	}, []);

	// Fetch PDF URL using signing token (no auth required)
	useEffect(() => {
		const fetchPdfUrl = async () => {
			try {
				const url = await convexClient.query(
					api.documents.queries.getDocumentUrlByToken,
					{ signingToken: token },
				);
				setPdfUrl(url);
			} catch (_error) {
				toast.error("Failed to load PDF");
			}
		};
		fetchPdfUrl();
	}, [convexClient, token]);

	// Track document view automatically when page loads (only if not already viewed)
	useEffect(() => {
		const markAsViewed = async () => {
			// Only mark as viewed if status is still pending
			if (recipient.status === "pending") {
				try {
					await convexClient.mutation(
						api.documents.recipients_mutations.submitRecipientSignature,
						{
							signingToken: token,
							status: "viewed",
						},
					);
				} catch (error) {
					// Silent failure - viewing tracking is not critical
					console.error("Failed to track document view:", error);
				}
			}
		};
		markAsViewed();
	}, [convexClient, token, recipient.status]);

	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		setNumPages(numPages);
	};

	// Signature submission mutation
	const submitSignatureMutation = useMutation({
		mutationFn: async ({
			signatureData,
			signatureType,
		}: {
			signatureData: string;
			signatureType: "drawn" | "typed" | "uploaded";
		}) => {
			// Determine the appropriate status based on recipient role
			const status =
				recipient.role === "signer"
					? "signed"
					: recipient.role === "approver"
						? "approved"
						: "viewed";

			return await convexClient.mutation(
				api.documents.recipients_mutations.submitRecipientSignature,
				{
					signingToken: token,
					status,
					signatureData: status === "signed" ? signatureData : undefined,
					signatureType: status === "signed" ? signatureType : undefined,
				},
			);
		},
		onSuccess: () => {
			toast.success("Document signed successfully!");
			setShowSignatureCapture(false);
			// Reload the page to show updated status
			window.location.reload();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save signature",
			);
			console.error(error);
		},
	});

	// Handle signature capture
	const handleSignatureCapture = async (
		signatureData: string,
		signatureType: "drawn" | "typed" | "uploaded",
	) => {
		submitSignatureMutation.mutate({ signatureData, signatureType });
	};

	const handleSignButtonClick = () => {
		// Check if all required fields are filled
		if (!allRequiredFieldsFilled) {
			const unfilledFields = requiredFields.filter((f) => !f.isFilled);
			toast.error(
				`Please fill all required fields first (${unfilledFields.length} remaining)`,
			);
			return;
		}

		// If the main signature field is already filled, submit directly
		if (
			mainSignatureField?.fieldType === "signature" &&
			isMainSignatureFilled
		) {
			const signatureData = mainSignatureField.currentSignatureImageUrl;
			if (!signatureData) {
				toast.error("Main signature is missing data. Please sign again.");
				return;
			}

			submitSignatureMutation.mutate({
				signatureData,
				signatureType: "drawn",
			});
			return;
		}

		setShowSignatureCapture(true);
	};

	const handleCancelSignature = () => {
		setShowSignatureCapture(false);
	};

	// Decline mutation
	const declineMutation = useMutation({
		mutationFn: async (reason: string) => {
			return await convexClient.mutation(
				api.documents.recipients_mutations.submitRecipientSignature,
				{
					signingToken: token,
					status: "declined",
					declineReason: reason,
				},
			);
		},
		onSuccess: () => {
			toast.success("Document declined");
			setShowDeclineDialog(false);
			// Reload the page to show updated status
			window.location.reload();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to decline document",
			);
			console.error(error);
		},
	});

	const handleDeclineClick = () => {
		setShowDeclineDialog(true);
	};

	const handleDeclineConfirm = () => {
		if (!declineReason.trim()) {
			toast.error("Please provide a reason for declining");
			return;
		}
		declineMutation.mutate(declineReason);
	};

	const handleDeclineCancel = () => {
		setShowDeclineDialog(false);
		setDeclineReason("");
	};

	// Field handling
	const handleFieldClick = (fieldId: Id<"signature_fields">) => {
		setActiveFieldId(fieldId);
		setShowFieldInput(true);
	};

	const handleFieldSave = async (
		value?: string,
		signatureImageUrl?: string,
	) => {
		if (!activeFieldId) return;

		await convexClient.mutation(api.signatures.mutations.saveFieldValue, {
			signingToken: token,
			fieldId: activeFieldId,
			value,
			signatureImageUrl,
			ipAddress: "0.0.0.0", // TODO: Get actual IP
			userAgent: navigator.userAgent,
		});

		await refetchFields();
		setShowFieldInput(false);
		setActiveFieldId(null);
	};

	// Calculate field completion progress
	const requiredFields = fields.filter((f) => f.isRequired);
	const filledRequiredFields = requiredFields.filter((f) => f.isFilled);
	const fieldCompletionPercent =
		requiredFields.length > 0
			? Math.round((filledRequiredFields.length / requiredFields.length) * 100)
			: 100;
	const allRequiredFieldsFilled = fieldCompletionPercent === 100;

	// Check for main signature field
	const mainSignatureField = fields.find((f) => f.isMainSignature === true);
	const isMainSignatureFilled = mainSignatureField?.isFilled || false;

	// Check if recipient has already completed their action
	const isCompleted =
		recipient.status === "signed" ||
		recipient.status === "approved" ||
		recipient.status === "declined";

	// Sort fields by page and position for navigation
	const sortedFields = [...fields].sort((a, b) => {
		if (a.page !== b.page) return a.page - b.page;
		if (a.y !== b.y) return a.y - b.y;
		return a.x - b.x;
	});

	// Get unfilled required fields for navigation
	const unfilledFields = sortedFields.filter((f) => !f.isFilled);

	// Scroll to field function
	const scrollToField = useCallback((fieldId: Id<"signature_fields">) => {
		const fieldElement = fieldRefs.current.get(fieldId);
		if (fieldElement && pdfContainerRef.current) {
			const container = pdfContainerRef.current;
			const fieldRect = fieldElement.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();

			// Calculate scroll position to center the field
			const scrollTop =
				container.scrollTop +
				(fieldRect.top - containerRect.top) -
				containerRect.height / 2 +
				fieldRect.height / 2;

			container.scrollTo({
				top: Math.max(0, scrollTop),
				behavior: "smooth",
			});

			// Highlight the field
			setActiveFieldId(fieldId);
		}
	}, []);

	// Navigate to next unfilled field
	const navigateToNextField = useCallback(() => {
		if (unfilledFields.length === 0) return;

		const nextIndex = (currentFieldIndex + 1) % unfilledFields.length;
		setCurrentFieldIndex(nextIndex);
		const nextField = unfilledFields[nextIndex];
		if (nextField) {
			scrollToField(nextField._id);
		}
	}, [currentFieldIndex, unfilledFields, scrollToField]);

	// Navigate to previous unfilled field
	const navigateToPreviousField = useCallback(() => {
		if (unfilledFields.length === 0) return;

		const prevIndex =
			currentFieldIndex === 0
				? unfilledFields.length - 1
				: currentFieldIndex - 1;
		setCurrentFieldIndex(prevIndex);
		const prevField = unfilledFields[prevIndex];
		if (prevField) {
			scrollToField(prevField._id);
		}
	}, [currentFieldIndex, unfilledFields, scrollToField]);

	// Auto-scroll to first unfilled field on load
	useEffect(() => {
		if (unfilledFields.length > 0 && !isCompleted) {
			const firstUnfilledField = unfilledFields[0];
			// Delay to allow PDF to render
			const timer = setTimeout(() => {
				if (firstUnfilledField) {
					scrollToField(firstUnfilledField._id);
				}
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [unfilledFields, isCompleted, scrollToField]);

	// State for collapsible sections on mobile
	const [isInfoExpanded, setIsInfoExpanded] = useState(false);

	// Format date helper
	const formatDate = (dateString: string | number) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	// Get role icon
	const getRoleIcon = (role: string) => {
		switch (role) {
			case "signer":
				return <PenLineIcon className="h-4 w-4" />;
			case "approver":
				return <ShieldCheckIcon className="h-4 w-4" />;
			default:
				return <UserIcon className="h-4 w-4" />;
		}
	};

	// Get status badge styles
	const getStatusBadge = (status: string) => {
		const baseStyles =
			"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";
		switch (status) {
			case "signed":
			case "approved":
				return {
					className: `${baseStyles} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`,
					icon: <CheckCircle2Icon className="h-3 w-3" />,
				};
			case "declined":
				return {
					className: `${baseStyles} bg-red-500/10 text-red-600 dark:text-red-400`,
					icon: <XCircleIcon className="h-3 w-3" />,
				};
			case "viewed":
				return {
					className: `${baseStyles} bg-blue-500/10 text-blue-600 dark:text-blue-400`,
					icon: <ClockIcon className="h-3 w-3" />,
				};
			default:
				return {
					className: `${baseStyles} bg-amber-500/10 text-amber-600 dark:text-amber-400`,
					icon: <ClockIcon className="h-3 w-3" />,
				};
		}
	};

	const statusBadge = getStatusBadge(recipient.status);

	return (
		<div className="h-screen bg-[#FAFAF9] dark:bg-background flex flex-col overflow-hidden">
			{/* Offline Banner - Global */}
			{!isOnline && (
				<div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2">
					<div className="flex items-center justify-center gap-2 text-amber-800">
						<WifiOffIcon className="h-4 w-4" />
						<span className="text-sm font-medium">
							You're offline. Your progress has been saved.
						</span>
					</div>
				</div>
			)}

			{/* Desktop Header - Full width top bar */}
			<header className="hidden lg:block border-b border-border/50 bg-white dark:bg-card shrink-0">
				<div className="h-14 px-6 flex items-center justify-between">
					{/* Left: Logo + Document context */}
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2.5">
							<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
								<FileTextIcon className="h-4 w-4 text-primary" />
							</div>
							<span className="font-semibold tracking-tight">Seal</span>
						</div>
						<div className="h-5 w-px bg-border/60" />
						<div className="flex items-center gap-2">
							<PenLineIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm text-muted-foreground">Sign</span>
							<span className="text-muted-foreground/40">·</span>
							<span className="text-sm font-medium truncate max-w-[300px]">
								{doc.name}
							</span>
						</div>
					</div>

					{/* Right: Status badge + Progress (when applicable) */}
					<div className="flex items-center gap-4">
						{!isCompleted && fields.length > 0 && (
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-2">
									<div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
											style={{ width: `${fieldCompletionPercent}%` }}
										/>
									</div>
									<span className="text-xs font-medium tabular-nums text-muted-foreground">
										{fieldCompletionPercent}%
									</span>
								</div>
								<div className="h-5 w-px bg-border/60" />
							</div>
						)}
						<span className={statusBadge.className}>
							{statusBadge.icon}
							{recipient.status.charAt(0).toUpperCase() +
								recipient.status.slice(1)}
						</span>
					</div>
				</div>
			</header>

			{/* Mobile Header - Only visible on small screens */}
			<header className="lg:hidden sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border/50">
				<div className="px-4 py-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
								<FileTextIcon className="h-4 w-4 text-primary" />
							</div>
							<span className="font-semibold text-sm tracking-tight">Seal</span>
						</div>
						{!isCompleted && fields.length > 0 && (
							<div className="flex items-center gap-2">
								<div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
									<div
										className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
										style={{ width: `${fieldCompletionPercent}%` }}
									/>
								</div>
								<span className="text-xs font-medium tabular-nums">
									{fieldCompletionPercent}%
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Mobile Document Info - Collapsible */}
				<Collapsible open={isInfoExpanded} onOpenChange={setIsInfoExpanded}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="w-full px-4 py-2.5 flex items-center justify-between bg-muted/30 border-t border-border/30 hover:bg-muted/50 transition-colors"
						>
							<div className="flex items-center gap-2 text-left flex-1 min-w-0">
								<span className="font-medium text-sm truncate">{doc.name}</span>
								<span className={statusBadge.className}>
									{statusBadge.icon}
									{recipient.status.charAt(0).toUpperCase() +
										recipient.status.slice(1)}
								</span>
							</div>
							{isInfoExpanded ? (
								<ChevronUpIcon className="h-4 w-4 text-muted-foreground shrink-0" />
							) : (
								<ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
							)}
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent className="bg-white dark:bg-card border-t border-border/30">
						<div className="px-4 py-4 space-y-4">
							{doc.description && (
								<p className="text-sm text-muted-foreground">
									{doc.description}
								</p>
							)}
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div className="space-y-1">
									<span className="text-xs text-muted-foreground uppercase tracking-wider">
										Recipient
									</span>
									<p className="font-medium truncate">
										{recipient.name || recipient.email}
									</p>
								</div>
								<div className="space-y-1">
									<span className="text-xs text-muted-foreground uppercase tracking-wider">
										Role
									</span>
									<p className="font-medium flex items-center gap-1.5">
										{getRoleIcon(recipient.role)}
										{recipient.role.charAt(0).toUpperCase() +
											recipient.role.slice(1)}
									</p>
								</div>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</header>

			{/* Main Layout - Side by side on desktop */}
			<div className="lg:flex flex-1 min-h-0 overflow-hidden">
				{/* Right Sidebar - Document Info (Desktop only) - Uses order-2 to appear on right */}
				<aside className="hidden lg:flex lg:w-[380px] xl:w-[420px] lg:flex-col lg:border-l border-border/50 bg-white dark:bg-card lg:order-2 overflow-hidden">
					{/* Sidebar Header - Document Details */}
					{doc.description && (
						<div className="p-6 border-b border-border/50">
							<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								About this document
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{doc.description}
							</p>
						</div>
					)}

					{/* Sidebar Content - Scrollable */}
					<div className="flex-1 overflow-y-auto p-6 space-y-6">
						{/* Progress Section - Only when not completed and has fields */}
						{!isCompleted && fields.length > 0 && (
							<>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
											Progress
										</h3>
										<span className="text-sm font-medium tabular-nums">
											{filledRequiredFields.length}/{requiredFields.length}
										</span>
									</div>
									<div className="h-2 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out rounded-full"
											style={{ width: `${fieldCompletionPercent}%` }}
										/>
									</div>
									{!allRequiredFieldsFilled && (
										<p className="text-xs text-muted-foreground">
											Complete all required fields to sign
										</p>
									)}
								</div>
								<Separator />
							</>
						)}

						{/* Recipient Info */}
						<div className="space-y-4">
							<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Recipient Details
							</h3>
							<div className="space-y-3">
								<div className="flex items-start gap-3">
									<div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
										<UserIcon className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="min-w-0">
										<p className="font-medium text-sm truncate">
											{recipient.name || "Not provided"}
										</p>
										<p className="text-xs text-muted-foreground truncate">
											{recipient.email}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-3 text-sm">
									<div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
										{getRoleIcon(recipient.role)}
									</div>
									<div>
										<p className="font-medium">
											{recipient.role.charAt(0).toUpperCase() +
												recipient.role.slice(1)}
										</p>
										<p className="text-xs text-muted-foreground">
											Assigned role
										</p>
									</div>
								</div>
							</div>
						</div>

						<Separator />

						{/* Timeline / Activity */}
						<div className="space-y-4">
							<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Activity
							</h3>
							<div className="space-y-3">
								{recipient.signedAt && (
									<div className="flex items-center gap-3 text-sm">
										<div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
											<CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
										</div>
										<div>
											<p className="font-medium">Signed</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(recipient.signedAt)}
											</p>
										</div>
									</div>
								)}
								{recipient.approvedAt && (
									<div className="flex items-center gap-3 text-sm">
										<div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
											<ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
										</div>
										<div>
											<p className="font-medium">Approved</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(recipient.approvedAt)}
											</p>
										</div>
									</div>
								)}
								{recipient.declinedAt && (
									<div className="flex items-center gap-3 text-sm">
										<div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
											<XCircleIcon className="h-4 w-4 text-red-600" />
										</div>
										<div>
											<p className="font-medium">Declined</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(recipient.declinedAt)}
											</p>
										</div>
									</div>
								)}
								{recipient.viewedAt && (
									<div className="flex items-center gap-3 text-sm">
										<div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
											<ClockIcon className="h-4 w-4 text-blue-600" />
										</div>
										<div>
											<p className="font-medium">Viewed</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(recipient.viewedAt)}
											</p>
										</div>
									</div>
								)}
								{!recipient.signedAt &&
									!recipient.approvedAt &&
									!recipient.declinedAt &&
									!recipient.viewedAt && (
										<div className="flex items-center gap-3 text-sm">
											<div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
												<ClockIcon className="h-4 w-4 text-amber-600" />
											</div>
											<div>
												<p className="font-medium">Pending</p>
												<p className="text-xs text-muted-foreground">
													Awaiting your action
												</p>
											</div>
										</div>
									)}
							</div>
						</div>

						{/* Resume Banner */}
						{!isCompleted &&
							filledRequiredFields.length > 0 &&
							filledRequiredFields.length < requiredFields.length && (
								<>
									<Separator />
									<div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
										<div className="flex items-start gap-3">
											<PlayCircleIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm text-blue-900 dark:text-blue-100">
													Resume where you left off
												</p>
												<p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
													{filledRequiredFields.length} of{" "}
													{requiredFields.length} fields completed
												</p>
												<Button
													size="sm"
													variant="ghost"
													className="mt-2 h-8 text-blue-700 hover:text-blue-800 hover:bg-blue-500/10 px-0"
													onClick={() => {
														if (unfilledFields.length > 0) {
															scrollToField(unfilledFields[0]._id);
														}
													}}
												>
													Continue
													<ArrowDownIcon className="h-3.5 w-3.5 ml-1" />
												</Button>
											</div>
										</div>
									</div>
								</>
							)}
					</div>

					{/* Sidebar Footer - Actions */}
					{!isCompleted && !showSignatureCapture && (
						<div className="p-6 border-t border-border/50 bg-muted/20">
							<div className="space-y-3">
								<Button
									size="lg"
									className="w-full h-12 text-base font-medium shadow-sm hover:shadow transition-shadow"
									onClick={handleSignButtonClick}
									disabled={submitSignatureMutation.isPending}
								>
									{submitSignatureMutation.isPending ? (
										"Submitting..."
									) : (
										<>
											<PenLineIcon className="h-4 w-4 mr-2" />
											{mainSignatureField && isMainSignatureFilled
												? recipient.role === "signer"
													? "Submit Signature"
													: recipient.role === "approver"
														? "Submit Approval"
														: "Submit"
												: recipient.role === "signer"
													? "Sign Document"
													: recipient.role === "approver"
														? "Approve Document"
														: "Mark as Viewed"}
										</>
									)}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full text-muted-foreground hover:text-foreground"
									onClick={handleDeclineClick}
									disabled={declineMutation.isPending}
								>
									Decline to sign
								</Button>
							</div>
						</div>
					)}

					{/* Completed state footer */}
					{isCompleted && recipient.status !== "declined" && pdfUrl && (
						<div className="p-6 border-t border-border/50 bg-muted/20">
							<Button
								variant="outline"
								size="lg"
								className="w-full h-12"
								onClick={() => {
									const link = document.createElement("a");
									link.href = pdfUrl;
									link.download = `${doc.name || "document"}.pdf`;
									document.body.appendChild(link);
									link.click();
									document.body.removeChild(link);
									toast.success("Download started");
								}}
							>
								<DownloadIcon className="h-4 w-4 mr-2" />
								Download Document
							</Button>
						</div>
					)}
				</aside>

				{/* Main Content Area - PDF Viewer (now on left with order-1) */}
				<main className="flex-1 flex flex-col min-h-0 lg:order-1 overflow-hidden">
					{/* Completion Banner - Shows when document is completed */}
					{isCompleted && (
						<div
							className={`px-4 py-3 ${
								recipient.status === "declined"
									? "bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/50"
									: "bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-900/50"
							}`}
						>
							<div className="flex items-center justify-center gap-2">
								{recipient.status === "declined" ? (
									<>
										<XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
										<span className="font-medium text-red-800 dark:text-red-200">
											Document Declined
										</span>
									</>
								) : (
									<>
										<CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
										<span className="font-medium text-emerald-800 dark:text-emerald-200">
											Document Completed
										</span>
									</>
								)}
							</div>
						</div>
					)}

					{/* Field Navigation Bar */}
					{!isCompleted && fields.length > 0 && (
						<div className="sticky top-0 lg:top-0 z-30 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-2.5">
							<div className="flex items-center justify-between max-w-4xl mx-auto">
								<div className="hidden sm:flex items-center gap-4">
									<div className="flex items-center gap-2">
										<div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
											<div
												className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
												style={{ width: `${fieldCompletionPercent}%` }}
											/>
										</div>
										<span className="text-sm font-medium tabular-nums">
											{fieldCompletionPercent}%
										</span>
									</div>
									<span className="text-sm text-muted-foreground">
										{filledRequiredFields.length} of {requiredFields.length}{" "}
										fields
									</span>
								</div>

								<div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
									{unfilledFields.length > 0 ? (
										<>
											<Button
												variant="outline"
												size="sm"
												className="h-9"
												onClick={navigateToPreviousField}
												disabled={unfilledFields.length <= 1}
											>
												<ArrowUpIcon className="h-4 w-4 sm:mr-1" />
												<span className="hidden sm:inline">Prev</span>
											</Button>
											<span className="text-sm text-muted-foreground tabular-nums px-2 min-w-[60px] text-center">
												{currentFieldIndex + 1} / {unfilledFields.length}
											</span>
											<Button
												variant="outline"
												size="sm"
												className="h-9"
												onClick={navigateToNextField}
												disabled={unfilledFields.length <= 1}
											>
												<span className="hidden sm:inline">Next</span>
												<ArrowDownIcon className="h-4 w-4 sm:ml-1" />
											</Button>
										</>
									) : (
										<div className="flex items-center gap-2 text-emerald-600">
											<CheckCircleIcon className="h-5 w-5" />
											<span className="text-sm font-medium">
												All fields completed
											</span>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* PDF Viewer Area */}
					<div
						ref={pdfContainerRef}
						className="flex-1 overflow-auto bg-[#EEEEE9] dark:bg-muted/30"
					>
						<div className="p-4 sm:p-6 lg:p-8">
							<div className="max-w-4xl mx-auto">
								{/* Page count header */}
								{numPages && (
									<div className="mb-4 flex items-center justify-between">
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<FileTextIcon className="h-4 w-4" />
											<span>
												{numPages} page{numPages > 1 ? "s" : ""}
											</span>
										</div>
										{numPages > 1 && (
											<span className="text-xs text-muted-foreground">
												Scroll to view all pages
											</span>
										)}
									</div>
								)}

								{/* PDF Document */}
								{pdfUrl ? (
									<div className="space-y-4">
										<Document
											file={pdfUrl}
											onLoadSuccess={onDocumentLoadSuccess}
											loading={
												<div className="bg-white dark:bg-card rounded-lg shadow-sm border border-border/50 p-16 text-center">
													<div className="animate-pulse space-y-4">
														<div className="h-4 bg-muted rounded w-1/3 mx-auto" />
														<div className="h-4 bg-muted rounded w-1/2 mx-auto" />
														<div className="h-4 bg-muted rounded w-2/5 mx-auto" />
													</div>
												</div>
											}
											error={
												<div className="bg-white dark:bg-card rounded-lg shadow-sm border border-destructive/30 p-16 text-center">
													<p className="text-destructive font-medium">
														Failed to load PDF
													</p>
													<p className="text-sm text-muted-foreground mt-1">
														Please try refreshing the page
													</p>
												</div>
											}
										>
											{Array.from(new Array(numPages), (_el, index) => {
												const pageNumber = index + 1;
												const fieldsOnPage = fields.filter(
													(f) => f.page === pageNumber,
												);

												return (
													<div
														key={`page_${pageNumber}`}
														className="relative bg-white dark:bg-card rounded-lg shadow-sm border border-border/50 overflow-hidden mb-4 last:mb-0"
													>
														<Page
															pageNumber={pageNumber}
															width={pdfWidth}
															renderTextLayer={true}
															renderAnnotationLayer={true}
															className="mx-auto"
															onLoadSuccess={(page) => {
																setPdfPageDimensions((prev) => {
																	const newMap = new Map(prev);
																	newMap.set(pageNumber, {
																		width: page.width,
																		height: page.height,
																	});
																	return newMap;
																});
															}}
														/>
														{/* Render field overlays on top of PDF */}
														{!isCompleted &&
															fieldsOnPage.map((field) => {
																const pageDims =
																	pdfPageDimensions.get(pageNumber);
																if (!pageDims) return null;

																return (
																	<FillableFieldOverlay
																		key={field._id}
																		ref={(el) => {
																			if (el) {
																				fieldRefs.current.set(field._id, el);
																			} else {
																				fieldRefs.current.delete(field._id);
																			}
																		}}
																		fieldId={field._id}
																		fieldType={field.fieldType}
																		label={field.label}
																		isRequired={field.isRequired}
																		isMainSignature={field.isMainSignature}
																		x={field.x}
																		y={field.y}
																		width={field.width}
																		height={field.height}
																		page={field.page}
																		currentPage={pageNumber}
																		pdfPageWidth={pageDims.width}
																		pdfPageHeight={pageDims.height}
																		value={field.currentValue}
																		isFilled={field.isFilled}
																		isActive={activeFieldId === field._id}
																		onClick={handleFieldClick}
																	/>
																);
															})}
														{/* Page number indicator */}
														{numPages && numPages > 1 && (
															<div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm">
																{pageNumber} / {numPages}
															</div>
														)}
													</div>
												);
											})}
										</Document>
									</div>
								) : (
									<div className="bg-white dark:bg-card rounded-lg shadow-sm border border-border/50 p-16 text-center">
										<div className="animate-pulse space-y-4">
											<div className="h-4 bg-muted rounded w-1/3 mx-auto" />
											<div className="h-4 bg-muted rounded w-1/2 mx-auto" />
											<div className="h-4 bg-muted rounded w-2/5 mx-auto" />
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Mobile Action Bar - Fixed at bottom on mobile */}
					{!isCompleted && !showSignatureCapture && (
						<div className="lg:hidden sticky bottom-0 z-40 bg-white/95 dark:bg-background/95 backdrop-blur-xl border-t border-border/50 p-4 safe-area-inset-bottom">
							<div className="flex gap-3">
								<Button
									variant="outline"
									size="lg"
									className="flex-1 h-12"
									onClick={handleDeclineClick}
									disabled={declineMutation.isPending}
								>
									Decline
								</Button>
								<Button
									size="lg"
									className="flex-1 h-12 font-medium"
									onClick={handleSignButtonClick}
									disabled={submitSignatureMutation.isPending}
								>
									{submitSignatureMutation.isPending ? (
										"Submitting..."
									) : mainSignatureField && isMainSignatureFilled ? (
										"Submit"
									) : recipient.role === "signer" ? (
										<>
											<PenLineIcon className="h-4 w-4 mr-2" />
											Sign
										</>
									) : recipient.role === "approver" ? (
										"Approve"
									) : (
										"Mark Viewed"
									)}
								</Button>
							</div>
						</div>
					)}

					{/* Mobile Completed Footer */}
					{isCompleted && (
						<div className="lg:hidden sticky bottom-0 z-40 bg-white/95 dark:bg-background/95 backdrop-blur-xl border-t border-border/50 p-4 safe-area-inset-bottom">
							{recipient.status !== "declined" && pdfUrl ? (
								<Button
									variant="outline"
									size="lg"
									className="w-full h-12"
									onClick={() => {
										const link = document.createElement("a");
										link.href = pdfUrl;
										link.download = `${doc.name || "document"}.pdf`;
										document.body.appendChild(link);
										link.click();
										document.body.removeChild(link);
										toast.success("Download started");
									}}
								>
									<DownloadIcon className="h-4 w-4 mr-2" />
									Download Document
								</Button>
							) : (
								<p className="text-center text-sm text-muted-foreground">
									{recipient.status === "declined"
										? "You have declined this document."
										: "Thank you for completing this document."}
								</p>
							)}
						</div>
					)}
				</main>
			</div>

			{/* Signature Capture Modal */}
			{!isCompleted && showSignatureCapture && (
				<div className="fixed inset-0 z-50 bg-background">
					<SignatureCapture
						recipientName={recipient.name}
						onSignatureCapture={handleSignatureCapture}
						onCancel={handleCancelSignature}
					/>
				</div>
			)}

			{/* Decline Dialog */}
			<Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Decline Document</DialogTitle>
						<DialogDescription>
							Please provide a reason for declining. This will be shared with
							the document sender.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="decline-reason">Reason</Label>
						<Textarea
							id="decline-reason"
							value={declineReason}
							onChange={(e) => setDeclineReason(e.target.value)}
							placeholder="Enter your reason here..."
							rows={4}
							className="resize-none"
						/>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={handleDeclineCancel}
							disabled={declineMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeclineConfirm}
							disabled={declineMutation.isPending}
						>
							{declineMutation.isPending ? "Declining..." : "Decline"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Field Input Manager */}
			{activeFieldId && (
				<FieldInputManager
					open={showFieldInput}
					onOpenChange={setShowFieldInput}
					fieldId={activeFieldId}
					fieldType={
						fields.find((f) => f._id === activeFieldId)?.fieldType || "text"
					}
					label={capitalizeFieldLabel(
						fields.find((f) => f._id === activeFieldId)?.label || "",
					)}
					isRequired={
						fields.find((f) => f._id === activeFieldId)?.isRequired || false
					}
					currentValue={
						fields.find((f) => f._id === activeFieldId)?.currentValue
					}
					currentSignatureImageUrl={
						fields.find((f) => f._id === activeFieldId)
							?.currentSignatureImageUrl
					}
					properties={fields.find((f) => f._id === activeFieldId)?.properties}
					onSave={handleFieldSave}
					recipientName={recipient.name}
				/>
			)}
		</div>
	);
}
