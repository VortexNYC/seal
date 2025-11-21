/**
 * Signature Capture Component
 *
 * Provides three methods for capturing signatures:
 * 1. Draw - Hand-drawn signature using canvas
 * 2. Type - Typed name with signature font
 * 3. Upload - Upload existing signature image
 */

import {
	CheckIcon,
	ImageIcon,
	PencilIcon,
	TypeIcon,
	XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SignatureType = "drawn" | "typed" | "uploaded";

interface SignatureCaptureProps {
	recipientName?: string;
	onSignatureCapture: (signature: string, type: SignatureType) => void;
	onCancel: () => void;
}

export function SignatureCapture({
	recipientName,
	onSignatureCapture,
	onCancel,
}: SignatureCaptureProps) {
	const [activeTab, setActiveTab] = useState<SignatureType>("drawn");
	const [typedName, setTypedName] = useState(recipientName || "");
	const [uploadedImage, setUploadedImage] = useState<string | null>(null);
	const signaturePadRef = useRef<SignatureCanvas>(null);

	// Handle drawn signature
	const handleDrawnSignature = () => {
		if (!signaturePadRef.current) return;

		if (signaturePadRef.current.isEmpty()) {
			alert("Please provide a signature first");
			return;
		}

		const dataUrl = signaturePadRef.current.toDataURL();
		onSignatureCapture(dataUrl, "drawn");
	};

	const handleClearDrawn = () => {
		signaturePadRef.current?.clear();
	};

	// Handle typed signature
	const handleTypedSignature = () => {
		if (!typedName.trim()) {
			alert("Please enter your name");
			return;
		}

		// Create canvas with typed name in signature font
		const canvas = document.createElement("canvas");
		canvas.width = 400;
		canvas.height = 100;
		const ctx = canvas.getContext("2d");

		if (!ctx) return;

		// Style the signature
		ctx.fillStyle = "#000000";
		ctx.font = "48px 'Dancing Script', cursive";
		ctx.textBaseline = "middle";
		ctx.fillText(typedName, 20, 50);

		const dataUrl = canvas.toDataURL();
		onSignatureCapture(dataUrl, "typed");
	};

	// Handle uploaded signature
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			alert("Please upload an image file");
			return;
		}

		// Validate file size (max 2MB)
		if (file.size > 2 * 1024 * 1024) {
			alert("Image must be smaller than 2MB");
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
			alert("Please upload a signature image first");
			return;
		}
		onSignatureCapture(uploadedImage, "uploaded");
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
					onValueChange={(v) => setActiveTab(v as SignatureType)}
				>
					<TabsList className="grid w-full grid-cols-3">
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
										className: "w-full h-[200px] cursor-crosshair",
									}}
									backgroundColor="rgb(255, 255, 255)"
									penColor="rgb(0, 0, 0)"
								/>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleClearDrawn}
								className="w-full"
							>
								<XIcon className="h-4 w-4 mr-2" />
								Clear
							</Button>
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
						{typedName && (
							<div className="border-2 border-gray-300 rounded-lg bg-white p-8">
								<p
									className="text-5xl text-center"
									style={{ fontFamily: "'Dancing Script', cursive" }}
								>
									{typedName}
								</p>
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							Your typed name will be converted to a signature style
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
								accept="image/*"
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
							Upload a PNG, JPG, or other image file (max 2MB)
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
							if (activeTab === "drawn") handleDrawnSignature();
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
		</Card>
	);
}
