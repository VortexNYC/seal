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
import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<FileTextIcon className="h-6 w-6" />
							<h1 className="text-xl font-semibold">Seal</h1>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<div className="max-w-5xl mx-auto space-y-6">
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

					{/* Completion Message */}
					{isCompleted && (
						<Card
							className={
								recipient.status === "declined"
									? "border-red-200 bg-red-50"
									: "border-green-200 bg-green-50"
							}
						>
							<CardContent className="pt-6">
								<p
									className={
										recipient.status === "declined"
											? "text-red-800 font-medium"
											: "text-green-800 font-medium"
									}
								>
									{recipient.status === "declined"
										? "✗ You have declined this document."
										: "✓ You have already completed this document."}
								</p>
								{recipient.signedAt && (
									<p className="text-sm text-green-700 mt-1">
										Signed on{" "}
										{new Date(recipient.signedAt).toLocaleDateString()}
									</p>
								)}
								{recipient.approvedAt && (
									<p className="text-sm text-green-700 mt-1">
										Approved on{" "}
										{new Date(recipient.approvedAt).toLocaleDateString()}
									</p>
								)}
								{recipient.declinedAt && (
									<p className="text-sm text-red-700 mt-1">
										Declined on{" "}
										{new Date(recipient.declinedAt).toLocaleDateString()}
									</p>
								)}
							</CardContent>
						</Card>
					)}

					{/* PDF Viewer */}
					<Card>
						<CardHeader>
							<CardTitle>Document Preview</CardTitle>
							<CardDescription>
								{numPages
									? `${numPages} page${numPages > 1 ? "s" : ""}`
									: "Loading..."}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{pdfUrl ? (
								<div className="border rounded-lg overflow-auto max-h-[600px] bg-gray-50 p-4">
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
											const pageWidth = 700;
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
														width={pageWidth}
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
								<Card>
									<CardContent className="pt-6">
										<div className="flex gap-4 justify-end">
											<Button
												variant="outline"
												size="lg"
												onClick={handleDeclineClick}
												disabled={declineMutation.isPending}
											>
												Decline
											</Button>
											{/* If main signature exists and is filled, show confirmation instead of signature capture */}
											{mainSignatureField && isMainSignatureFilled ? (
												<Button
													size="lg"
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
