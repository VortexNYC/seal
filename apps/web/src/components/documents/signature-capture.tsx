/**
 * Signature Capture Component
 *
 * Provides multiple methods for capturing signatures:
 * 1. Saved - Select from saved signature library (authenticated users only)
 * 2. Draw - Hand-drawn signature using canvas
 * 3. Type - Typed name with signature font selection
 * 4. Upload - Upload existing signature image (PNG/JPG only)
 *
 * SEA-104/105/106/107: Signature Capture Interface
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
	BookmarkIcon,
	CheckIcon,
	ImageIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	StarIcon,
	TrashIcon,
	TypeIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SignatureType = "drawn" | "typed" | "uploaded";
type TabType = SignatureType | "saved";

// Available signature fonts
const SIGNATURE_FONTS = [
	{
		name: "Dancing Script",
		value: "dancing-script",
		cssFamily: "'Dancing Script', cursive",
	},
	{
		name: "Great Vibes",
		value: "great-vibes",
		cssFamily: "'Great Vibes', cursive",
	},
	{ name: "Pacifico", value: "pacifico", cssFamily: "'Pacifico', cursive" },
	{ name: "Caveat", value: "caveat", cssFamily: "'Caveat', cursive" },
	{
		name: "Sacramento",
		value: "sacramento",
		cssFamily: "'Sacramento', cursive",
	},
] as const;

type SignatureFont = (typeof SIGNATURE_FONTS)[number]["value"];

interface SignatureCaptureProps {
	recipientName?: string;
	onSignatureCapture: (signature: string, type: SignatureType) => void;
	onCancel: () => void;
	/** Whether to show the signature library (requires authentication) */
	showLibrary?: boolean;
}

export function SignatureCapture({
	recipientName,
	onSignatureCapture,
	onCancel,
	showLibrary = false,
}: SignatureCaptureProps) {
	const [activeTab, setActiveTab] = useState<TabType>(
		showLibrary ? "saved" : "drawn",
	);
	const [typedName, setTypedName] = useState(recipientName || "");
	const [selectedFont, setSelectedFont] =
		useState<SignatureFont>("dancing-script");
	const [uploadedImage, setUploadedImage] = useState<string | null>(null);
	const signaturePadRef = useRef<SignatureCanvas>(null);

	// Undo history for drawn signatures
	const [signatureHistory, setSignatureHistory] = useState<string[]>([]);

	// Selected saved signature
	const [selectedSavedSignature, setSelectedSavedSignature] =
		useState<Id<"saved_signatures"> | null>(null);

	// Save signature dialog
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [saveSignatureName, setSaveSignatureName] = useState("");
	const [saveAsDefault, setSaveAsDefault] = useState(false);
	const [pendingSignatureData, setPendingSignatureData] = useState<{
		data: string;
		type: SignatureType;
	} | null>(null);

	// Signature library queries and mutations (only if showLibrary is true)
	const { data: savedSignatures = [] } = useQuery({
		...convexQuery(api.saved_signatures.queries.getUserSignatures, {}),
		enabled: showLibrary,
	});

	const saveSignatureMutation = useMutation(
		api.saved_signatures.mutations.saveSignature,
	);
	const deleteSignatureMutation = useMutation(
		api.saved_signatures.mutations.deleteSignature,
	);
	const setDefaultMutation = useMutation(
		api.saved_signatures.mutations.updateSignature,
	);
	const incrementUsageMutation = useMutation(
		api.saved_signatures.mutations.incrementUsageCount,
	);

	// Get the current font's CSS family
	const currentFontFamily =
		SIGNATURE_FONTS.find((f) => f.value === selectedFont)?.cssFamily ||
		"'Dancing Script', cursive";

	// Save current state to history before drawing
	const saveToHistory = useCallback(() => {
		if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
			const dataUrl = signaturePadRef.current.toDataURL();
			setSignatureHistory((prev) => [...prev, dataUrl]);
		}
	}, []);

	// Handle drawn signature
	const handleDrawnSignature = () => {
		if (!signaturePadRef.current) return;

		if (signaturePadRef.current.isEmpty()) {
			toast.error("Please provide a signature first");
			return;
		}

		const dataUrl = signaturePadRef.current.toDataURL();
		handleSubmitWithSaveOption(dataUrl, "drawn");
	};

	const handleClearDrawn = () => {
		// Save current state before clearing
		saveToHistory();
		signaturePadRef.current?.clear();
	};

	// Redo/Undo - restore the last saved state
	const handleUndoDrawn = () => {
		if (signatureHistory.length === 0) {
			toast.info("Nothing to undo");
			return;
		}

		const lastState = signatureHistory[signatureHistory.length - 1];
		setSignatureHistory((prev) => prev.slice(0, -1));

		if (signaturePadRef.current && lastState) {
			signaturePadRef.current.fromDataURL(lastState);
		}
	};

	// Handle typed signature
	const handleTypedSignature = () => {
		if (!typedName.trim()) {
			toast.error("Please enter your name");
			return;
		}

		// Create canvas with typed name in selected signature font
		const canvas = document.createElement("canvas");
		canvas.width = 500;
		canvas.height = 120;
		const ctx = canvas.getContext("2d");

		if (!ctx) return;

		// Clear canvas with transparent background
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Style the signature
		ctx.fillStyle = "#000000";
		ctx.font = `52px ${currentFontFamily}`;
		ctx.textBaseline = "middle";

		// Measure text to center it
		const textWidth = ctx.measureText(typedName).width;
		const x = Math.max(10, (canvas.width - textWidth) / 2);
		ctx.fillText(typedName, x, 60);

		const dataUrl = canvas.toDataURL();
		handleSubmitWithSaveOption(dataUrl, "typed");
	};

	// Handle uploaded signature - PNG/JPG only
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type - only PNG and JPG allowed
		const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
		if (!allowedTypes.includes(file.type)) {
			toast.error("Please upload a PNG or JPG image only");
			e.target.value = ""; // Reset file input
			return;
		}

		// Validate file size (max 5MB as per acceptance criteria)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image must be smaller than 5MB");
			e.target.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const dataUrl = event.target?.result as string;
			setUploadedImage(dataUrl);
		};
		reader.readAsDataURL(file);
	};

	const handleUploadedSignature = () => {
		if (!uploadedImage) {
			toast.error("Please upload a signature image first");
			return;
		}
		handleSubmitWithSaveOption(uploadedImage, "uploaded");
	};

	// Handle selecting a saved signature
	const handleSavedSignature = async () => {
		if (!selectedSavedSignature) {
			toast.error("Please select a signature from your library");
			return;
		}

		const signature = savedSignatures.find(
			(s: Doc<"saved_signatures">) => s._id === selectedSavedSignature,
		);
		if (!signature) {
			toast.error("Selected signature not found");
			return;
		}

		// Increment usage count
		try {
			await incrementUsageMutation({ signatureId: selectedSavedSignature });
		} catch {
			// Non-critical error, don't block the signature
		}

		onSignatureCapture(signature.signatureImageUrl, signature.signatureType);
	};

	// Handle saving a new signature to library
	const handleSaveToLibrary = async () => {
		if (!pendingSignatureData) return;

		if (!saveSignatureName.trim()) {
			toast.error("Please enter a name for your signature");
			return;
		}

		try {
			await saveSignatureMutation({
				name: saveSignatureName.trim(),
				signatureImageUrl: pendingSignatureData.data,
				signatureType: pendingSignatureData.type,
				fontFamily:
					pendingSignatureData.type === "typed" ? currentFontFamily : undefined,
				setAsDefault: saveAsDefault,
			});

			toast.success("Signature saved to library");
			setShowSaveDialog(false);
			setSaveSignatureName("");
			setSaveAsDefault(false);

			// Now submit the signature
			onSignatureCapture(pendingSignatureData.data, pendingSignatureData.type);
		} catch (error) {
			toast.error("Failed to save signature", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	// Handle deleting a saved signature
	const handleDeleteSavedSignature = async (
		signatureId: Id<"saved_signatures">,
	) => {
		try {
			await deleteSignatureMutation({ signatureId });
			toast.success("Signature deleted");
			if (selectedSavedSignature === signatureId) {
				setSelectedSavedSignature(null);
			}
		} catch (error) {
			toast.error("Failed to delete signature", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	// Handle setting a signature as default
	const handleSetDefault = async (signatureId: Id<"saved_signatures">) => {
		try {
			await setDefaultMutation({ signatureId, isDefault: true });
			toast.success("Default signature updated");
		} catch (error) {
			toast.error("Failed to update default signature", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	// Modified submit handler that offers to save to library
	const handleSubmitWithSaveOption = (data: string, type: SignatureType) => {
		if (showLibrary && savedSignatures.length < 10) {
			// Offer to save to library
			setPendingSignatureData({ data, type });
			setShowSaveDialog(true);
		} else {
			// Just submit directly
			onSignatureCapture(data, type);
		}
	};

	// Direct submit without saving (from dialog)
	const handleSubmitWithoutSaving = () => {
		if (pendingSignatureData) {
			onSignatureCapture(pendingSignatureData.data, pendingSignatureData.type);
		}
		setShowSaveDialog(false);
		setPendingSignatureData(null);
	};

	return (
		<Card className="w-full max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle>Sign Document</CardTitle>
				<CardDescription>
					Choose your preferred method to sign this document
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as TabType)}
				>
					<TabsList
						className={`grid w-full ${showLibrary ? "grid-cols-4" : "grid-cols-3"}`}
					>
						{showLibrary && (
							<TabsTrigger value="saved" className="flex items-center gap-2">
								<BookmarkIcon className="h-4 w-4" />
								Saved
							</TabsTrigger>
						)}
						<TabsTrigger value="drawn" className="flex items-center gap-2">
							<PencilIcon className="h-4 w-4" />
							Draw
						</TabsTrigger>
						<TabsTrigger value="typed" className="flex items-center gap-2">
							<TypeIcon className="h-4 w-4" />
							Type
						</TabsTrigger>
						<TabsTrigger value="uploaded" className="flex items-center gap-2">
							<ImageIcon className="h-4 w-4" />
							Upload
						</TabsTrigger>
					</TabsList>

					{/* Saved Tab (only shown if showLibrary is true) */}
					{showLibrary && (
						<TabsContent value="saved" className="space-y-4">
							{savedSignatures.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<BookmarkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p className="text-sm">No saved signatures yet</p>
									<p className="text-xs mt-1">
										Create a signature using Draw, Type, or Upload and save it
										for quick reuse
									</p>
								</div>
							) : (
								<div className="grid gap-3">
									{savedSignatures.map((sig: Doc<"saved_signatures">) => (
										<div
											key={sig._id}
											className={`relative border-2 rounded-lg p-3 cursor-pointer transition-colors ${
												selectedSavedSignature === sig._id
													? "border-primary bg-primary/5"
													: "border-gray-200 hover:border-gray-300"
											}`}
											onClick={() => setSelectedSavedSignature(sig._id)}
										>
											<div className="flex items-center gap-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm truncate">
															{sig.name}
														</span>
														{sig.isDefault && (
															<StarIcon className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
														)}
													</div>
													<div className="text-xs text-muted-foreground mt-1">
														{sig.signatureType} · Used {sig.usageCount} times
													</div>
												</div>
												<img
													src={sig.signatureImageUrl}
													alt={sig.name}
													className="h-12 w-24 object-contain bg-white rounded border"
												/>
												<div className="flex flex-col gap-1">
													{!sig.isDefault && (
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={(e) => {
																e.stopPropagation();
																handleSetDefault(sig._id);
															}}
															title="Set as default"
														>
															<StarIcon className="h-3.5 w-3.5" />
														</Button>
													)}
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-destructive hover:text-destructive"
														onClick={(e) => {
															e.stopPropagation();
															handleDeleteSavedSignature(sig._id);
														}}
														title="Delete signature"
													>
														<TrashIcon className="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								{savedSignatures.length}/10 signatures saved
							</p>
						</TabsContent>
					)}

					{/* Draw Tab */}
					<TabsContent value="drawn" className="space-y-4">
						<div className="space-y-2">
							<Label>Draw your signature</Label>
							<div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
								<SignatureCanvas
									ref={signaturePadRef}
									canvasProps={{
										width: 600,
										height: 200,
										className: "w-full h-[200px] cursor-crosshair touch-none",
									}}
									backgroundColor="rgb(255, 255, 255)"
									penColor="rgb(0, 0, 0)"
								/>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleUndoDrawn}
									className="flex-1"
									disabled={signatureHistory.length === 0}
								>
									<RotateCcwIcon className="h-4 w-4 mr-2" />
									Undo
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleClearDrawn}
									className="flex-1"
								>
									<XIcon className="h-4 w-4 mr-2" />
									Clear
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Use your mouse or finger to draw your signature above
							</p>
						</div>
					</TabsContent>

					{/* Type Tab */}
					<TabsContent value="typed" className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="typed-name">Type your full name</Label>
							<Input
								id="typed-name"
								value={typedName}
								onChange={(e) => setTypedName(e.target.value)}
								placeholder="John Doe"
								className="text-lg"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="font-select">Select signature style</Label>
							<Select
								value={selectedFont}
								onValueChange={(v) => setSelectedFont(v as SignatureFont)}
							>
								<SelectTrigger id="font-select">
									<SelectValue placeholder="Select a font" />
								</SelectTrigger>
								<SelectContent>
									{SIGNATURE_FONTS.map((font) => (
										<SelectItem key={font.value} value={font.value}>
											<span style={{ fontFamily: font.cssFamily }}>
												{font.name}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{typedName && (
							<div className="border-2 border-gray-300 rounded-lg bg-white p-8">
								<p
									className="text-5xl text-center"
									style={{ fontFamily: currentFontFamily }}
								>
									{typedName}
								</p>
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							Your typed name will be converted to a signature style using the
							selected font
						</p>
					</TabsContent>

					{/* Upload Tab */}
					<TabsContent value="uploaded" className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="signature-upload">
								Upload your signature image
							</Label>
							<Input
								id="signature-upload"
								type="file"
								accept=".png,.jpg,.jpeg"
								onChange={handleFileUpload}
							/>
						</div>
						{uploadedImage && (
							<div className="border-2 border-gray-300 rounded-lg bg-white p-4">
								<img
									src={uploadedImage}
									alt="Uploaded signature"
									className="max-h-[200px] mx-auto"
								/>
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							Upload a PNG or JPG image file (max 5MB)
						</p>
					</TabsContent>
				</Tabs>

				{/* Action Buttons */}
				<div className="flex gap-4 mt-6">
					<Button variant="outline" onClick={onCancel} className="flex-1">
						Cancel
					</Button>
					<Button
						onClick={() => {
							if (activeTab === "saved") handleSavedSignature();
							else if (activeTab === "drawn") handleDrawnSignature();
							else if (activeTab === "typed") handleTypedSignature();
							else handleUploadedSignature();
						}}
						className="flex-1"
					>
						<CheckIcon className="h-4 w-4 mr-2" />
						Accept & Sign
					</Button>
				</div>

				{/* Legal Text */}
				<p className="text-xs text-muted-foreground text-center mt-4">
					By clicking "Accept & Sign", you agree that this is a legal
					representation of your signature.
				</p>
			</CardContent>

			{/* Save to Library Dialog */}
			<Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save to Signature Library?</DialogTitle>
						<DialogDescription>
							Would you like to save this signature for quick reuse in future
							documents?
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						{pendingSignatureData && (
							<div className="border rounded-lg bg-white p-4">
								<img
									src={pendingSignatureData.data}
									alt="Signature preview"
									className="max-h-[100px] mx-auto"
								/>
							</div>
						)}
						<div className="space-y-2">
							<Label htmlFor="signature-name">Signature name</Label>
							<Input
								id="signature-name"
								value={saveSignatureName}
								onChange={(e) => setSaveSignatureName(e.target.value)}
								placeholder="e.g., My Personal Signature"
							/>
						</div>
						<div className="flex items-center space-x-2">
							<Checkbox
								id="set-default"
								checked={saveAsDefault}
								onCheckedChange={(checked) =>
									setSaveAsDefault(checked === true)
								}
							/>
							<Label htmlFor="set-default" className="text-sm font-normal">
								Set as my default signature
							</Label>
						</div>
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2">
						<Button
							variant="outline"
							onClick={handleSubmitWithoutSaving}
							className="flex-1"
						>
							Skip & Sign
						</Button>
						<Button
							onClick={handleSaveToLibrary}
							disabled={!saveSignatureName.trim()}
							className="flex-1"
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							Save & Sign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
