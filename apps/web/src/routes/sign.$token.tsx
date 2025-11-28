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
	CheckCircleIcon,
	DownloadIcon,
	FileTextIcon,
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b sticky top-0 z-30 bg-background">
				<div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<FileTextIcon className="h-5 w-5 sm:h-6 sm:w-6" />
							<h1 className="text-lg sm:text-xl font-semibold">Seal</h1>
						</div>
						{/* Mobile progress indicator in header */}
						{!isCompleted && fields.length > 0 && (
							<div className="flex items-center gap-2 sm:hidden">
								<Progress value={fieldCompletionPercent} className="w-16 h-2" />
								<span className="text-xs font-medium">
									{fieldCompletionPercent}%
								</span>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
				<div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
					{/* Document Info Card */}
					<Card>
						<CardHeader>
							<CardTitle>{doc.name}</CardTitle>
							<CardDescription>
								{doc.description || "Please review and sign this document"}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4 text-sm">
								<div className="space-y-2">
									<div>
										<span className="font-medium">Recipient:</span>{" "}
										{recipient.name || recipient.email}
									</div>
									<div>
										<span className="font-medium">Role:</span>{" "}
										{recipient.role.charAt(0).toUpperCase() +
											recipient.role.slice(1)}
									</div>
									<div>
										<span className="font-medium">Status:</span>{" "}
										<span
											className={
												recipient.status === "declined"
													? "text-red-600 font-medium"
													: isCompleted
														? "text-green-600 font-medium"
														: "text-yellow-600 font-medium"
											}
										>
											{recipient.status.charAt(0).toUpperCase() +
												recipient.status.slice(1)}
										</span>
									</div>
								</div>

								{/* Field completion progress */}
								{!isCompleted && fields.length > 0 && (
									<div className="space-y-2 pt-2 border-t">
										<div className="flex items-center justify-between text-xs">
											<span className="font-medium">Field Completion</span>
											<span className="text-muted-foreground">
												{filledRequiredFields.length} of {requiredFields.length}{" "}
												required fields
											</span>
										</div>
										<Progress value={fieldCompletionPercent} className="h-2" />
										{!allRequiredFieldsFilled && (
											<p className="text-xs text-muted-foreground">
												Please fill all required fields before signing
											</p>
										)}
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Completion Screen */}
					{isCompleted && (
						<Card
							className={
								recipient.status === "declined"
									? "border-red-200 bg-red-50"
									: "border-green-200 bg-green-50"
							}
						>
							<CardHeader>
								<CardTitle
									className={
										recipient.status === "declined"
											? "text-red-800 flex items-center gap-2"
											: "text-green-800 flex items-center gap-2"
									}
								>
									{recipient.status === "declined" ? (
										<>
											<span className="text-2xl">✗</span>
											Document Declined
										</>
									) : (
										<>
											<CheckCircleIcon className="h-6 w-6" />
											Document Completed
										</>
									)}
								</CardTitle>
								<CardDescription>
									{recipient.status === "declined"
										? "You have declined to sign this document."
										: "Thank you for completing this document."}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Completion details */}
								<div className="grid gap-2 text-sm">
									<div className="flex items-center justify-between py-2 border-b">
										<span className="text-muted-foreground">Document</span>
										<span className="font-medium">{doc.name}</span>
									</div>
									<div className="flex items-center justify-between py-2 border-b">
										<span className="text-muted-foreground">Your Role</span>
										<span className="font-medium capitalize">
											{recipient.role}
										</span>
									</div>
									<div className="flex items-center justify-between py-2 border-b">
										<span className="text-muted-foreground">Status</span>
										<span
											className={
												recipient.status === "declined"
													? "font-medium text-red-600 capitalize"
													: "font-medium text-green-600 capitalize"
											}
										>
											{recipient.status}
										</span>
									</div>
									{recipient.signedAt && (
										<div className="flex items-center justify-between py-2 border-b">
											<span className="text-muted-foreground">Signed At</span>
											<span className="font-medium">
												{new Date(recipient.signedAt).toLocaleString()}
											</span>
										</div>
									)}
									{recipient.approvedAt && (
										<div className="flex items-center justify-between py-2 border-b">
											<span className="text-muted-foreground">Approved At</span>
											<span className="font-medium">
												{new Date(recipient.approvedAt).toLocaleString()}
											</span>
										</div>
									)}
									{recipient.declinedAt && (
										<div className="flex items-center justify-between py-2 border-b">
											<span className="text-muted-foreground">Declined At</span>
											<span className="font-medium">
												{new Date(recipient.declinedAt).toLocaleString()}
											</span>
										</div>
									)}
								</div>

								{/* Download button for completed documents */}
								{recipient.status !== "declined" && pdfUrl && (
									<div className="pt-4">
										<Button
											variant="outline"
											className="w-full"
											onClick={() => {
												// Create a download link
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

								{/* Confirmation message */}
								{recipient.status !== "declined" && (
									<div className="pt-2 text-sm text-muted-foreground text-center">
										A confirmation email has been sent to your email address.
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Field Navigation Bar - Hidden on very small screens, shown in header instead */}
					{!isCompleted && fields.length > 0 && (
						<Card className="sticky top-12 sm:top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
							<CardContent className="py-2 sm:py-3">
								<div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
									{/* Progress info - hidden on mobile since it's in header */}
									<div className="hidden sm:flex items-center gap-3">
										<div className="flex items-center gap-2">
											<Progress
												value={fieldCompletionPercent}
												className="w-24 h-2"
											/>
											<span className="text-sm font-medium">
												{fieldCompletionPercent}%
											</span>
										</div>
										<span className="text-sm text-muted-foreground">
											{filledRequiredFields.length} of {requiredFields.length}{" "}
											fields
										</span>
									</div>

									{/* Navigation controls - Full width on mobile */}
									<div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
										{unfilledFields.length > 0 ? (
											<>
												<Button
													variant="outline"
													size="default"
													className="h-11 min-w-[44px] sm:h-9"
													onClick={navigateToPreviousField}
													disabled={unfilledFields.length <= 1}
												>
													<ArrowUpIcon className="h-4 w-4 sm:mr-1" />
													<span className="hidden sm:inline">Prev</span>
												</Button>
												<span className="text-sm text-muted-foreground px-2 min-w-[60px] text-center">
													{currentFieldIndex + 1} / {unfilledFields.length}
												</span>
												<Button
													variant="outline"
													size="default"
													className="h-11 min-w-[44px] sm:h-9"
													onClick={navigateToNextField}
													disabled={unfilledFields.length <= 1}
												>
													<span className="hidden sm:inline">Next</span>
													<ArrowDownIcon className="h-4 w-4 sm:ml-1" />
												</Button>
											</>
										) : (
											<div className="flex items-center gap-2 text-green-600">
												<CheckCircleIcon className="h-5 w-5" />
												<span className="text-sm font-medium">
													All fields completed
												</span>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* PDF Viewer */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Document Preview</CardTitle>
								<CardDescription>
									{numPages
										? `${numPages} page${numPages > 1 ? "s" : ""}`
										: "Loading..."}
								</CardDescription>
							</div>
							{/* Page indicator */}
							{numPages && numPages > 1 && (
								<div className="text-sm text-muted-foreground">
									Scroll to view all pages
								</div>
							)}
						</CardHeader>
						<CardContent>
							{pdfUrl ? (
								<div
									ref={pdfContainerRef}
									className="border rounded-lg overflow-auto max-h-[600px] bg-gray-50 p-4"
								>
									<Document
										file={pdfUrl}
										onLoadSuccess={onDocumentLoadSuccess}
										loading={
											<div className="p-12 text-center text-muted-foreground">
												Loading PDF...
											</div>
										}
										error={
											<div className="p-12 text-center text-destructive">
												Failed to load PDF
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
													className="relative mb-4"
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
												</div>
											);
										})}
									</Document>
								</div>
							) : (
								<div className="p-12 text-center text-muted-foreground">
									Loading PDF...
								</div>
							)}
						</CardContent>
					</Card>

					{/* Signature Capture Modal or Action Buttons */}
					{!isCompleted && (
						<>
							{showSignatureCapture ? (
								<SignatureCapture
									recipientName={recipient.name}
									onSignatureCapture={handleSignatureCapture}
									onCancel={handleCancelSignature}
								/>
							) : (
								<Card className="sticky bottom-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:relative sm:bg-background">
									<CardContent className="py-4 sm:pt-6">
										<div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:justify-end">
											<Button
												variant="outline"
												size="lg"
												className="w-full sm:w-auto h-12 sm:h-11 min-h-[44px]"
												onClick={handleDeclineClick}
												disabled={declineMutation.isPending}
											>
												Decline
											</Button>
											{/* If main signature exists and is filled, show confirmation instead of signature capture */}
											{mainSignatureField && isMainSignatureFilled ? (
												<Button
													size="lg"
													className="w-full sm:w-auto h-12 sm:h-11 min-h-[44px]"
													onClick={() => {
														toast.success(
															"Document already signed via main signature field",
														);
													}}
													disabled
													variant="outline"
												>
													✓ Signed via Field
												</Button>
											) : (
												<Button
													size="lg"
													className="w-full sm:w-auto h-12 sm:h-11 min-h-[44px]"
													onClick={handleSignButtonClick}
													disabled={submitSignatureMutation.isPending}
												>
													{recipient.role === "signer" && "Sign Document"}
													{recipient.role === "approver" && "Approve Document"}
													{recipient.role === "viewer" && "Mark as Viewed"}
												</Button>
											)}
										</div>
									</CardContent>
								</Card>
							)}

							{/* Decline Dialog */}
							<Dialog
								open={showDeclineDialog}
								onOpenChange={setShowDeclineDialog}
							>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Decline Document</DialogTitle>
										<DialogDescription>
											Please provide a reason for declining this document. This
											will be shared with the document sender.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-2">
										<Label htmlFor="decline-reason">Reason for declining</Label>
										<Textarea
											id="decline-reason"
											value={declineReason}
											onChange={(e) => setDeclineReason(e.target.value)}
											placeholder="Enter your reason here..."
											rows={4}
										/>
									</div>
									<DialogFooter>
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
											{declineMutation.isPending
												? "Declining..."
												: "Decline Document"}
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
										fields.find((f) => f._id === activeFieldId)?.fieldType ||
										"text"
									}
									label={capitalizeFieldLabel(
										fields.find((f) => f._id === activeFieldId)?.label || "",
									)}
									isRequired={
										fields.find((f) => f._id === activeFieldId)?.isRequired ||
										false
									}
									currentValue={
										fields.find((f) => f._id === activeFieldId)?.currentValue
									}
									currentSignatureImageUrl={
										fields.find((f) => f._id === activeFieldId)
											?.currentSignatureImageUrl
									}
									properties={
										fields.find((f) => f._id === activeFieldId)?.properties
									}
									onSave={handleFieldSave}
									recipientName={recipient.name}
								/>
							)}
						</>
					)}
				</div>
			</main>
		</div>
	);
}
