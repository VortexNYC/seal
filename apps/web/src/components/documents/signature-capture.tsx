/**
 * Signature Capture — product shell over kumo-docs ESignature + saved library.
 *
 * SEA-104/105/106/107: Signature Capture Interface
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import {
  Bookmark,
  Check,
  Image,
  Pencil,
  Plus,
  Star,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import {
  ESignature,
  type ESignatureMethod,
  type ESignatureResult,
} from "@/components/kumo-docs/e-signature";
import {
  createSavedSignature,
  deleteSavedSignature,
  incrementSavedSignatureUsage,
  listSavedSignatures,
  updateSavedSignature,
  type ApiSavedSignature,
} from "@/lib/api-client";
import { parseSelectValue } from "@/lib/select-values";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SignatureType = ESignatureMethod;
type TabType = SignatureType | "saved";

const TAB_TYPES = [
  "drawn",
  "typed",
  "uploaded",
  "saved",
] as const satisfies readonly TabType[];

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
}: SignatureCaptureProps): JSX.Element {
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
  const [pendingCapture, setPendingCapture] =
    useState<ESignatureResult | null>(null);

  const [selectedSavedSignature, setSelectedSavedSignature] = useState<
    string | null
  >(null);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSignatureName, setSaveSignatureName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<{
    data: string;
    type: SignatureType;
  } | null>(null);

  const queryClient = useQueryClient();

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

  const handleSavedSignature = async (): Promise<void> => {
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

    try {
      await incrementUsageMutation.mutateAsync(selectedSavedSignature);
    } catch {
      // Non-critical
    }

    onSignatureCapture(signature.signatureImageUrl, signature.signatureType);
  };

  const handleSaveToLibrary = async (): Promise<void> => {
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
        setAsDefault: saveAsDefault,
      });

      toast.success("Signature saved to library");
      setShowSaveDialog(false);
      setSaveSignatureName("");
      setSaveAsDefault(false);
      onSignatureCapture(pendingSignatureData.data, pendingSignatureData.type);
    } catch (error) {
      toast.error("Failed to save signature", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDeleteSavedSignature = async (
    signatureId: string
  ): Promise<void> => {
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

  const handleSetDefault = async (signatureId: string): Promise<void> => {
    try {
      await setDefaultMutation.mutateAsync({
        id: signatureId,
        isDefault: true,
      });
      toast.success("Default signature updated");
    } catch (error) {
      toast.error("Failed to update default signature", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleSubmitWithSaveOption = (
    data: string,
    type: SignatureType
  ): void => {
    if (showLibrary && savedSignatures.length < 10) {
      setPendingSignatureData({ data, type });
      setShowSaveDialog(true);
      return;
    }
    onSignatureCapture(data, type);
  };

  const handleSubmitWithoutSaving = (): void => {
    if (pendingSignatureData) {
      onSignatureCapture(pendingSignatureData.data, pendingSignatureData.type);
    }
    setShowSaveDialog(false);
    setPendingSignatureData(null);
  };

  const handleAccept = (): void => {
    if (activeTab === "saved") {
      void handleSavedSignature();
      return;
    }
    if (!pendingCapture) {
      toast.error("Please provide a signature first");
      return;
    }
    handleSubmitWithSaveOption(pendingCapture.dataUrl, pendingCapture.method);
  };

  if (!hasAvailableMethods) {
    return (
      <LayerCard className="mx-auto w-full max-w-2xl">
        <LayerCard.Primary>
          <h3 className="text-base font-semibold">Sign Document</h3>
          <p className="text-kumo-secondary text-sm">
            No signature methods are currently available.
          </p>
        </LayerCard.Primary>
        <div className="text-kumo-secondary p-6 pt-0 text-sm">
          Contact your organization administrator to re-enable signing methods.
          <div className="mt-4">
            <Button variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
      </LayerCard>
    );
  }

  const tabs = [
    ...(showLibrary
      ? [
          {
            value: "saved",
            label: (
              <span className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
                <Bookmark className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            ),
          },
        ]
      : []),
    ...(allowedTabs.includes("drawn")
      ? [
          {
            value: "drawn",
            label: (
              <span className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Draw</span>
              </span>
            ),
          },
        ]
      : []),
    ...(allowedTabs.includes("typed")
      ? [
          {
            value: "typed",
            label: (
              <span className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
                <TextT className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Type</span>
              </span>
            ),
          },
        ]
      : []),
    ...(allowedTabs.includes("uploaded")
      ? [
          {
            value: "uploaded",
            label: (
              <span className="flex min-h-[44px] items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
                <Image className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Upload</span>
              </span>
            ),
          },
        ]
      : []),
  ];

  const captureMethod: SignatureType =
    activeTab === "saved" ? (allowedTabs[0] ?? "drawn") : activeTab;

  return (
    <LayerCard className="mx-auto w-full max-w-2xl">
      <LayerCard.Primary>
        <h3 className="text-base font-semibold">Sign Document</h3>
        <p className="text-kumo-secondary text-sm">
          Choose your preferred method to sign this document
        </p>
      </LayerCard.Primary>
      <div className="p-6 pt-0">
        <Tabs
          tabs={tabs}
          value={activeTab}
          onValueChange={(v) => {
            const next = parseSelectValue(v, TAB_TYPES) ?? activeTab;
            setActiveTab(next);
            setPendingCapture(null);
          }}
        />

        {showLibrary && activeTab === "saved" ? (
          <div className="space-y-4">
            {savedSignatures.length === 0 ? (
              <div className="text-kumo-secondary py-8 text-center">
                <Bookmark className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">No saved signatures yet</p>
                <p className="mt-1 text-xs">
                  Create a signature using Draw, Type, or Upload and save it for
                  quick reuse
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
                        ? "border-kumo-brand bg-kumo-brand/5"
                        : "border-kumo-hairline hover:border-kumo-hairline"
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
                          {sig.isDefault ? (
                            <Star className="fill-kumo-warning text-kumo-warning h-3 w-3 shrink-0" />
                          ) : null}
                        </div>
                        <div className="text-kumo-secondary mt-1 text-xs">
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
                        {!sig.isDefault ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7"
                            aria-label={`Set ${sig.name} as default signature`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSetDefault(sig.id);
                            }}
                            title="Set as default"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          aria-label={`Delete saved signature ${sig.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteSavedSignature(sig.id);
                          }}
                          title="Delete signature"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-kumo-secondary text-xs">
              {savedSignatures.length}/10 signatures saved
            </p>
          </div>
        ) : null}

        {activeTab !== "saved" ? (
          <ESignature
            key={captureMethod}
            methods={[captureMethod]}
            showTabs={false}
            showActions={false}
            defaultTypedName={recipientName}
            onPendingChange={setPendingCapture}
          />
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-12 min-h-[44px] flex-1 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            className="h-12 min-h-[44px] flex-1 sm:h-11"
          >
            <Check className="mr-2 h-4 w-4" />
            Accept & Sign
          </Button>
        </div>

        <p className="text-kumo-secondary mt-4 text-center text-xs">
          By clicking "Accept & Sign", you agree that this is a legal
          representation of your signature.
        </p>
      </div>

      <Dialog.Root open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <Dialog>
          <Dialog.Title>Save to Signature Library?</Dialog.Title>
          <Dialog.Description>
            Would you like to save this signature for quick reuse in future
            documents?
          </Dialog.Description>
          <div className="space-y-4 py-4">
            {pendingSignatureData ? (
              <div
                // vortex-allow-color: signature library preview represents white paper in both themes
                className="border-kumo-hairline rounded-lg border bg-white p-4"
              >
                <img
                  src={pendingSignatureData.data}
                  alt="Signature preview"
                  className="mx-auto max-h-[100px]"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="signature-name">Signature name</Label>
              <Input
                id="signature-name"
                value={saveSignatureName}
                onChange={(e) => setSaveSignatureName(e.target.value)}
                placeholder="e.g., My Personal Signature"
                aria-label="Signature name"
              />
            </div>
            <Checkbox
              checked={saveAsDefault}
              onCheckedChange={(checked) => setSaveAsDefault(checked)}
              label="Set as my default signature"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleSubmitWithoutSaving}
              className="flex-1"
            >
              Skip & Sign
            </Button>
            <Button
              onClick={() => {
                void handleSaveToLibrary();
              }}
              disabled={!saveSignatureName.trim()}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Save & Sign
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </LayerCard>
  );
}
