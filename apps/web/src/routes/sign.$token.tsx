/**
 * Public Signing Page
 * Route: /sign/$token
 *
 * Allows recipients to view and sign documents using their unique signing token.
 * This is an unauthenticated route - no Clerk login required.
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute("/sign/$token")({
	component: SigningPage,
});

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

	// PDF viewer state
	const [numPages, setNumPages] = useState<number | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);

	// Signature capture state
	const [showSignatureCapture, setShowSignatureCapture] = useState(false);
	const [showDeclineDialog, setShowDeclineDialog] = useState(false);
	const [declineReason, setDeclineReason] = useState("");

	// Fetch PDF URL
	useEffect(() => {
		const fetchPdfUrl = async () => {
			try {
				const url = await convexClient.query(
					api.documents.queries.getDocumentUrl,
					{ documentId: doc._id },
				);
				setPdfUrl(url);
			} catch (_error) {
				toast.error("Failed to load PDF");
			}
		};
		fetchPdfUrl();
	}, [convexClient, doc._id]);

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
							<div className="space-y-2 text-sm">
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
											isCompleted
												? "text-green-600 font-medium"
												: "text-yellow-600 font-medium"
										}
									>
										{recipient.status.charAt(0).toUpperCase() +
											recipient.status.slice(1)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Completion Message */}
					{isCompleted && (
						<Card className="border-green-200 bg-green-50">
							<CardContent className="pt-6">
								<p className="text-green-800 font-medium">
									✓ You have already completed this document.
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
										{Array.from(new Array(numPages), (_el, index) => (
											<Page
												key={`page_${index + 1}`}
												pageNumber={index + 1}
												width={700}
												renderTextLayer={true}
												renderAnnotationLayer={true}
												className="mb-4 mx-auto"
											/>
										))}
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
											<Button
												size="lg"
												onClick={handleSignButtonClick}
												disabled={submitSignatureMutation.isPending}
											>
												{recipient.role === "signer" && "Sign Document"}
												{recipient.role === "approver" && "Approve Document"}
												{recipient.role === "viewer" && "Mark as Viewed"}
											</Button>
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
						</>
					)}
				</div>
			</main>
		</div>
	);
}
