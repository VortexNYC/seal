/**
 * Public Signing Page
 * Route: /sign/$token
 *
 * Allows recipients to view and sign documents using their unique signing token.
 * This is an unauthenticated route - no Clerk login required.
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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

	// Fetch PDF URL
	useEffect(() => {
		const fetchPdfUrl = async () => {
			try {
				const url = await convexClient.query(
					api.documents.queries.getDocumentUrl,
					{ documentId: doc._id },
				);
				setPdfUrl(url);
			} catch (error) {
				toast.error("Failed to load PDF");
			}
		};
		fetchPdfUrl();
	}, [convexClient, doc._id]);

	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		setNumPages(numPages);
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
									{recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}
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
										Signed on {new Date(recipient.signedAt).toLocaleDateString()}
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

					{/* Action Buttons */}
					{!isCompleted && (
						<Card>
							<CardContent className="pt-6">
								<div className="flex gap-4 justify-end">
									<Button variant="outline" size="lg" disabled>
										Decline
									</Button>
									<Button size="lg" disabled>
										{recipient.role === "signer" && "Sign Document"}
										{recipient.role === "approver" && "Approve Document"}
										{recipient.role === "viewer" && "Mark as Viewed"}
									</Button>
								</div>
								<p className="text-sm text-muted-foreground mt-4 text-center">
									Signature capture UI will be implemented in next phase
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</main>
		</div>
	);
}
