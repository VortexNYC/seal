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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSavedSignature,
  deleteSavedSignature,
  incrementSavedSignatureUsage,
  listSavedSignatures,
  updateSavedSignature,
  type ApiSavedSignature,
} from "@/lib/api-client";
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
import { useCallback, useEffect, useRef, useState } from "react";
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
import { parseSelectValue } from "@/lib/select-values";
import { cn } from "@/lib/utils";

type SignatureType = "drawn" | "typed" | "uploaded";
type TabType = SignatureType | "saved";

const TAB_TYPES = [
  "drawn",
  "typed",
  "uploaded",
  "saved",
] as const satisfies readonly TabType[];

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

const SIGNATURE_FONT_VALUES = SIGNATURE_FONTS.map((font) => font.value);

interface SignatureCaptureProps {
  recipientName?: string;
  onSignatureCapture: (signature: string, type: SignatureType) => void;
  onCancel: () => void;
  /** Whether to show the signature library (requires authentication) */
  showLibrary?: boolean;
  /** Organization-level allowed signature types. Defaults to all types. */
  allowedSignatureTypes?: readonly ("draw" | "type" | "upload")[];
}

export function SignatureCapture({
  recipientName,
  onSignatureCapture,
  onCancel,
  showLibrary = false,
  allowedSignatureTypes,
}: SignatureCaptureProps) {
  // Map org-level types ("draw"/"type"/"upload") to internal tab types ("drawn"/"typed"/"uploaded")
  const ORG_TO_TAB: Record<string, SignatureType> = {
    draw: "drawn",
    type: "typed",
    upload: "uploaded",
  };
  const allowedTabs: SignatureType[] = allowedSignatureTypes
    ? allowedSignatureTypes.map((t) => ORG_TO_TAB[t]).filter(Boolean)
    : ["drawn", "typed", "uploaded"];
  const hasAvailableMethods = allowedTabs.length > 0 || showLibrary;

  const defaultTab: TabType = showLibrary
    ? "saved"
    : (allowedTabs[0] ?? "drawn");
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [typedName, setTypedName] = useState(recipientName || "");
  const [selectedFont, setSelectedFont] =
    useState<SignatureFont>("dancing-script");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // SEA-116: Responsive canvas width for mobile
  const [canvasWidth, setCanvasWidth] = useState(600);

  // SEA-116: Update canvas width on mount and resize
  useEffect(() => {
    const updateCanvasWidth = () => {
      if (canvasContainerRef.current) {
        // Get container width minus padding (16px on each side)
        const containerWidth = canvasContainerRef.current.offsetWidth - 4;
        // Clamp between 280px (mobile min) and 600px (desktop max)
        setCanvasWidth(Math.max(280, Math.min(600, containerWidth)));
      }
    };

    updateCanvasWidth();

    // Throttled resize and orientation change handler
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateCanvasWidth);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Undo history for drawn signatures
  const [signatureHistory, setSignatureHistory] = useState<string[]>([]);

  // Selected saved signature
  const [selectedSavedSignature, setSelectedSavedSignature] = useState<
    string | null
  >(null);

  // Save signature dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSignatureName, setSaveSignatureName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<{
    data: string;
    type: SignatureType;
  } | null>(null);

  const queryClient = useQueryClient();

  // Signature library queries and mutations (only if showLibrary is true)
  const { data: savedSignatures = [] } = useQuery({
    queryKey: ["saved-signatures"],
    queryFn: listSavedSignatures,
    enabled: showLibrary,
  });

  const saveSignatureMutation = useMutation({
    mutationFn: createSavedSignature,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-signatures"] });
    },
  });
  const deleteSignatureMutation = useMutation({
    mutationFn: deleteSavedSignature,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-signatures"] });
    },
  });
  const setDefaultMutation = useMutation({
    mutationFn: (args: { id: string; isDefault: boolean }) =>
      updateSavedSignature(args.id, { isDefault: args.isDefault }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-signatures"] });
    },
  });
  const incrementUsageMutation = useMutation({
    mutationFn: incrementSavedSignatureUsage,
  });

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
    // vortex-allow-color: Canvas signature rendering requires a concrete ink color.
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
    reader.addEventListener("load", (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === "string") {
        setUploadedImage(dataUrl);
      }
    });
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
      (s: ApiSavedSignature) => s.id === selectedSavedSignature
    );
    if (!signature) {
      toast.error("Selected signature not found");
      return;
    }

    // Increment usage count
    try {
      if (selectedSavedSignature) {
        await incrementUsageMutation.mutateAsync(selectedSavedSignature);
      }
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
      await saveSignatureMutation.mutateAsync({
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
    signatureId: string
  ) => {
    try {
      await deleteSignatureMutation.mutateAsync(signatureId);
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
  const handleSetDefault = async (signatureId: string) => {
    try {
      await setDefaultMutation.mutateAsync({ id: signatureId, isDefault: true });
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

  if (!hasAvailableMethods) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sign Document</CardTitle>
          <CardDescription>
            No signature methods are currently available.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground pt-0 text-sm">
          Contact your organization administrator to re-enable signing methods.
          <div className="mt-4">
            <Button variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Sign Document</CardTitle>
        <CardDescription>
          Choose your preferred method to sign this document
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(parseSelectValue(v, TAB_TYPES) ?? activeTab)
          }
        >
          {/* SEA-116: Mobile-optimized tabs with icon-only on small screens */}
          <TabsList
            className="grid h-auto w-full"
            style={{
              gridTemplateColumns: `repeat(${allowedTabs.length + (showLibrary ? 1 : 0)}, minmax(0, 1fr))`,
            }}
          >
            {showLibrary && (
              <TabsTrigger
                value="saved"
                className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3"
              >
                <BookmarkIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Saved</span>
              </TabsTrigger>
            )}
            {allowedTabs.includes("drawn") && (
              <TabsTrigger
                value="drawn"
                className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3"
              >
                <PencilIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Draw</span>
              </TabsTrigger>
            )}
            {allowedTabs.includes("typed") && (
              <TabsTrigger
                value="typed"
                className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3"
              >
                <TypeIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Type</span>
              </TabsTrigger>
            )}
            {allowedTabs.includes("uploaded") && (
              <TabsTrigger
                value="uploaded"
                className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3"
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Upload</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Saved Tab (only shown if showLibrary is true) */}
          {showLibrary && (
            <TabsContent value="saved" className="space-y-4">
              {savedSignatures.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <BookmarkIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm">No saved signatures yet</p>
                  <p className="mt-1 text-xs">
                    Create a signature using Draw, Type, or Upload and save it
                    for quick reuse
                  </p>
                </div>
              ) : (
                <div
                  className="grid gap-3"
                  role="listbox"
                  aria-label="Saved signatures"
                >
                  {savedSignatures.map((sig: ApiSavedSignature) => (
                    <div
                      key={sig.id}
                      role="option"
                      aria-selected={selectedSavedSignature === sig.id}
                      tabIndex={0}
                      className={cn(
                        "relative cursor-pointer rounded-lg border-2 p-3 transition-colors",
                        selectedSavedSignature === sig.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border"
                      )}
                      onClick={() => setSelectedSavedSignature(sig.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSavedSignature(sig.id);
                        }
                      }}
                      aria-label={`Select ${sig.name} signature`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {sig.name}
                            </span>
                            {sig.isDefault && (
                              <StarIcon className="fill-warning text-warning h-3 w-3 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {sig.signatureType} · Used {sig.usageCount} times
                          </div>
                        </div>
                        <img
                          src={sig.signatureImageUrl}
                          alt={sig.name}
                          // vortex-allow-color: signature thumbnails represent white paper in both themes
                          className="h-12 w-24 rounded border bg-white object-contain"
                        />
                        <div className="flex flex-col gap-1">
                          {!sig.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Set ${sig.name} as default signature`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleSetDefault(sig.id);
                              }}
                              title="Set as default"
                            >
                              <StarIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            aria-label={`Delete saved signature ${sig.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteSavedSignature(sig.id);
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
              <p className="text-muted-foreground text-xs">
                {savedSignatures.length}/10 signatures saved
              </p>
            </TabsContent>
          )}

          {/* Draw Tab */}
          {allowedTabs.includes("drawn") && (
            <TabsContent value="drawn" className="space-y-4">
              <div className="space-y-2">
                <Label>Draw your signature</Label>
                {/* SEA-116: Responsive container for signature canvas */}
                <div
                  ref={canvasContainerRef}
                  // vortex-allow-color: signature capture pad represents white paper in both themes
                  className="border-border overflow-hidden rounded-lg border-2 border-dashed bg-white"
                >
                  {/* vortex-allow-color: SignatureCanvas forwards colors to canvas and cannot resolve CSS tokens. */}
                  <SignatureCanvas
                    ref={signaturePadRef}
                    canvasProps={{
                      width: canvasWidth,
                      height: 200,
                      className:
                        "w-full h-[200px] cursor-crosshair touch-none select-none",
                      style: { touchAction: "none" },
                    }}
                    // vortex-allow-color: signature capture pad represents white paper in both themes
                    backgroundColor="rgb(255, 255, 255)"
                    // vortex-allow-color: signature capture ink must stay physically black on white paper
                    penColor="rgb(0, 0, 0)"
                  />
                </div>
                {/* SEA-116: Larger touch targets for mobile */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleUndoDrawn}
                    className="h-11 min-h-[44px] flex-1"
                    disabled={signatureHistory.length === 0}
                  >
                    <RotateCcwIcon className="mr-2 h-4 w-4" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleClearDrawn}
                    className="h-11 min-h-[44px] flex-1"
                  >
                    <XIcon className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Use your mouse or finger to draw your signature above
                </p>
              </div>
            </TabsContent>
          )}

          {/* Type Tab */}
          {allowedTabs.includes("typed") && (
            <TabsContent value="typed" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typed-name">Type your full name</Label>
                {/* SEA-116: Larger input for mobile with proper virtual keyboard handling */}
                <Input
                  id="typed-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="John Doe"
                  className="h-12 text-lg sm:h-10"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-select">Select signature style</Label>
                <Select
                  value={selectedFont}
                  onValueChange={(v) =>
                    setSelectedFont(
                      parseSelectValue(v, SIGNATURE_FONT_VALUES) ?? selectedFont
                    )
                  }
                >
                  <SelectTrigger id="font-select" className="h-11 sm:h-10">
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
                <div
                  // vortex-allow-color: signature preview represents white paper in both themes
                  className="border-border overflow-hidden rounded-lg border-2 bg-white p-4 sm:p-8"
                >
                  {/* SEA-116: Responsive font size for mobile */}
                  <p
                    className="truncate text-center text-3xl sm:text-5xl"
                    style={{ fontFamily: currentFontFamily }}
                  >
                    {typedName}
                  </p>
                </div>
              )}
              <p className="text-muted-foreground text-sm">
                Your typed name will be converted to a signature style using the
                selected font
              </p>
            </TabsContent>
          )}

          {/* Upload Tab */}
          {allowedTabs.includes("uploaded") && (
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
                <div
                  // vortex-allow-color: uploaded signature preview represents white paper in both themes
                  className="border-border rounded-lg border-2 bg-white p-4"
                >
                  <img
                    src={uploadedImage}
                    alt="Uploaded signature"
                    className="mx-auto max-h-[200px]"
                  />
                </div>
              )}
              <p className="text-muted-foreground text-sm">
                Upload a PNG or JPG image file (max 5MB)
              </p>
            </TabsContent>
          )}
        </Tabs>

        {/* SEA-116: Mobile-optimized action buttons with proper touch targets */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-12 min-h-[44px] flex-1 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (activeTab === "saved") void handleSavedSignature();
              else if (activeTab === "drawn") handleDrawnSignature();
              else if (activeTab === "typed") handleTypedSignature();
              else handleUploadedSignature();
            }}
            className="h-12 min-h-[44px] flex-1 sm:h-11"
          >
            <CheckIcon className="mr-2 h-4 w-4" />
            Accept & Sign
          </Button>
        </div>

        {/* Legal Text */}
        <p className="text-muted-foreground mt-4 text-center text-xs">
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
              <div
                // vortex-allow-color: signature library preview represents white paper in both themes
                className="rounded-lg border bg-white p-4"
              >
                <img
                  src={pendingSignatureData.data}
                  alt="Signature preview"
                  className="mx-auto max-h-[100px]"
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
          <DialogFooter className="flex-col gap-2 sm:flex-row">
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
              <PlusIcon className="mr-2 h-4 w-4" />
              Save & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
