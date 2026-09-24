/**
 * Public Signing Page
 * Route: /sign/$token
 *
 * Allows recipients to view and sign documents using their unique signing token.
 * This is an unauthenticated route - no login required.
 */

import { Textarea } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { buttonVariants } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretUp,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  FileText,
  Pen,
  PlayCircle,
  ShieldCheck,
  Spinner,
  User,
  WarningCircle,
  WifiSlash,
  XCircle,
} from "@phosphor-icons/react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  type ErrorComponentProps,
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import { EsignConsentDialog } from "@/components/documents/esign-consent-dialog";
import { FieldInputManager } from "@/components/documents/field-input-manager";
import { FillableFieldOverlay } from "@/components/documents/fillable-field-overlay";
import { PdfSigningDocumentSurface } from "@/components/documents/pdf-signing-document-surface";
import { SignatureCapture } from "@/components/documents/signature-capture";
import { SealLogo } from "@/components/seal-logo";
import { DictateNextSignerDialog } from "@/components/signing/dictate-next-signer-dialog";
import { DocumentExpiredPage } from "@/components/signing/document-expired-page";
import { RedirectCountdown } from "@/components/signing/redirect-countdown";
import { SignerAuthGate } from "@/components/signing/signer-auth-gate";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  getClientIp,
  getPublicSigningPaymentConfigs,
  getPublicSigningPdf,
  getPublicSigningSignedPdfUrl,
  getSigningByToken,
  getSigningFields,
  recordPublicSigningConsent,
  recordPublicSigningOptOut,
  savePublicSigningFieldValue,
  submitPublicSigning,
} from "@/lib/api-client";
import { formatMoney, money } from "@/lib/money";
import { pageSEO } from "@/lib/seo";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function asFieldProperties(value: unknown):
  | {
      placeholder?: string;
      defaultValue?: string;
      options?: string[];
      maxLength?: number;
      minLength?: number;
      pattern?: string;
      helpText?: string;
    }
  | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const v = Object.fromEntries(Object.entries(value));
  const options = Array.isArray(v.options)
    ? v.options.filter((o): o is string => typeof o === "string")
    : undefined;
  const maxLength =
    typeof v.maxLength === "number" ? Math.floor(v.maxLength) : undefined;
  const minLength =
    typeof v.minLength === "number" ? Math.floor(v.minLength) : undefined;
  return {
    placeholder: typeof v.placeholder === "string" ? v.placeholder : undefined,
    defaultValue:
      typeof v.defaultValue === "string" ? v.defaultValue : undefined,
    options,
    maxLength,
    minLength,
    pattern: typeof v.pattern === "string" ? v.pattern : undefined,
    helpText: typeof v.helpText === "string" ? v.helpText : undefined,
  };
}

function asFieldValidationRules(
  value: unknown
): { min?: number; max?: number } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const v = Object.fromEntries(Object.entries(value));
  const min = typeof v.min === "number" ? v.min : undefined;
  const max = typeof v.max === "number" ? v.max : undefined;
  if (min === undefined && max === undefined) return undefined;
  return { min, max };
}

// ─── Embedded Signing (iFrame SDK) ──────────────────────────────────
type SealEventType =
  | "seal:ready"
  | "seal:viewed"
  | "seal:signed"
  | "seal:declined"
  | "seal:error";

function postSealEvent(type: SealEventType, payload: Record<string, unknown>) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ type, ...payload }, "*");
}

function useEmbeddedSigning(token: string) {
  const isEmbedded = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("embed") === "true";
  }, []);

  // Parse optional embed params
  const embedParams = useMemo(() => {
    if (!isEmbedded) return { hideDecline: false };
    const params = new URLSearchParams(window.location.search);
    return {
      hideDecline: params.get("hideDecline") === "true",
    };
  }, [isEmbedded]);

  // Emit ready event on mount
  useEffect(() => {
    if (isEmbedded) {
      postSealEvent("seal:ready", { token });
    }
  }, [isEmbedded, token]);

  // Listen for incoming messages from host
  useEffect(() => {
    if (!isEmbedded) return undefined;
    const handler = (event: MessageEvent) => {
      if (!event.data?.type) return;
      if (event.data.type === "seal:close") {
        // Host requested close — nothing to clean up on our side
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isEmbedded]);

  return { isEmbedded, embedParams, postSealEvent };
}

function SigningErrorComponent({ error }: ErrorComponentProps) {
  const isInvalidToken =
    error instanceof Error &&
    /invalid.*token|token.*invalid|not found/i.test(error.message);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <LayerCard className="w-full max-w-md text-center">
        <LayerCard.Primary className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-kumo-elevated mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              <WarningCircle className="text-kumo-secondary h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">
              {isInvalidToken ? "Invalid Signing Link" : "Something went wrong"}
            </h2>
            <p className="text-kumo-secondary mt-2 text-sm">
              {isInvalidToken
                ? "This signing link is invalid or has expired. Please check the link and try again, or contact the sender for a new link."
                : "We encountered an error loading this document. Please try again or contact support."}
            </p>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "w-full sm:w-auto"
              )}
            >
              Go Home
            </Link>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </LayerCard.Primary>
      </LayerCard>
    </div>
  );
}

export const Route = createFileRoute("/sign/$token")({
  component: SigningPage,
  errorComponent: SigningErrorComponent,
  head: () => ({
    meta: [
      { title: pageSEO.sign.title },
      { name: "description", content: pageSEO.sign.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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

function formatDate(dateString: string | number): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRoleIcon(role: string): ReactElement {
  switch (role) {
    case "signer":
      return <Pen className="h-4 w-4" />;
    case "approver":
      return <ShieldCheck className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string): {
  className: string;
  icon: ReactElement;
} {
  const baseStyles =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";
  switch (status) {
    case "signed":
    case "approved":
      return {
        className: cn(baseStyles, "bg-kumo-success-tint text-kumo-success"),
        icon: <CheckCircle className="h-3 w-3" />,
      };
    case "declined":
      return {
        className: cn(baseStyles, "bg-kumo-danger/10 text-kumo-danger"),
        icon: <XCircle className="h-3 w-3" />,
      };
    case "viewed":
      return {
        className: cn(baseStyles, "bg-kumo-info-tint text-kumo-info"),
        icon: <Clock className="h-3 w-3" />,
      };
    default:
      return {
        className: cn(baseStyles, "bg-kumo-warning-tint text-kumo-warning"),
        icon: <Clock className="h-3 w-3" />,
      };
  }
}

function SigningPage() {
  const { token } = Route.useParams();
  const { track } = useAnalytics();
  const { isEmbedded, embedParams } = useEmbeddedSigning(token);

  // Fetch recipient and document data using the signing token
  const { data } = useSuspenseQuery({
    queryKey: ["public-signing", token],
    queryFn: () => getSigningByToken(token),
  });

  const {
    recipient,
    document: doc,
    waitingForPreviousGroup,
    sequentialProgress,
    branding,
    signingSettings,
  } = data;

  // ESIGN consent state — skip modal if already consented
  const [hasConsented, setHasConsented] = useState(!!recipient.esignConsentAt);
  const [isConsentSubmitting, setIsConsentSubmitting] = useState(false);
  const [authVerified, setAuthVerified] = useState(
    recipient.authVerified ??
      !recipient.authMethod ||
      recipient.authMethod === "none"
  );

  // Fetch fields assigned to this recipient
  const { data: fields, refetch: refetchFields } = useSuspenseQuery({
    queryKey: ["public-signing", token, "fields"],
    queryFn: () => getSigningFields(token),
  });

  // Load payment configs for payment field overlays
  const { data: paymentConfigs } = useSuspenseQuery({
    queryKey: ["public-signing", token, "payment-configs"],
    queryFn: () => getPublicSigningPaymentConfigs(token),
  });

  const paymentInfoByFieldId = useMemo(() => {
    const map = new Map<
      string,
      { totalAmountCents: number; currency: string; paymentStatus?: string }
    >();
    for (const config of paymentConfigs) {
      map.set(config.fieldId, {
        totalAmountCents: config.totalAmountCents,
        currency: config.currency,
        paymentStatus: config.paymentStatus ?? undefined,
      });
    }
    return map;
  }, [paymentConfigs]);

  // Check if all payment fields are paid (blocks signing if not)
  const hasUnpaidPayments = useMemo(() => {
    return paymentConfigs.some((config) => config.paymentStatus !== "paid");
  }, [paymentConfigs]);

  // PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // Field input state
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
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
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Post-signing flow: dictation and redirect
  const [showDictateDialog, setShowDictateDialog] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);

  // Client IP for audit trail (fetched from API)
  const [clientIp, setClientIp] = useState("unknown");
  useEffect(() => {
    getClientIp()
      .then((ip) => setClientIp(ip))
      .catch(() => {
        // Silently fall back to "unknown" — IP is best-effort
      });
  }, []);

  // ESIGN consent handlers
  const handleConsentAccept = useCallback(async () => {
    setIsConsentSubmitting(true);
    try {
      await recordPublicSigningConsent(token, {
        ipAddress: clientIp,
        consentVersion: "1.0",
      });
      setHasConsented(true);
      if (isEmbedded) {
        postSealEvent("seal:viewed", { token });
      }
    } catch {
      toast.error("Failed to record consent. Please try again.");
    } finally {
      setIsConsentSubmitting(false);
    }
  }, [token, clientIp, isEmbedded]);

  const handleConsentDecline = useCallback(() => {
    // The decline state is handled inside the consent dialog component.
    // If the user truly wants to leave, they navigate away themselves.
  }, []);

  const handleOptOut = useCallback(
    async (method: string) => {
      try {
        await recordPublicSigningOptOut(token, {
          ipAddress: clientIp,
          method,
        });
      } catch {
        // Opt-out logging is best-effort — don't block the user's action
      }
    },
    [token, clientIp]
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
        const availableWidth = containerWidth - 32;
        setPdfWidth(Math.max(280, Math.min(700, availableWidth)));
      }
    };

    // Initial calculation after mount
    const timer = setTimeout(updatePdfWidth, 100);

    // Throttled resize handler
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePdfWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Fetch PDF using signing token (no auth required)
  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const blob = await getPublicSigningPdf(token);
        setPdfUrl(URL.createObjectURL(blob));
      } catch {
        toast.error("Failed to load PDF");
      }
    };
    void fetchPdfUrl();
  }, [token]);

  // Track document view automatically when page loads (only if not already viewed)
  useEffect(() => {
    const markAsViewed = async () => {
      // Only mark as viewed if status is still pending
      if (recipient.status === "pending") {
        try {
          await submitPublicSigning(token, {
            status: "viewed",
            ipAddress: clientIp,
            userAgent: navigator.userAgent,
          });
        } catch {
          // Silent failure - viewing tracking is not critical
        }
      }
    };
    void markAsViewed();
  }, [token, recipient.status, clientIp]);

  const onDocumentLoadSuccess = ({
    numPages: loadedPageCount,
  }: {
    numPages: number;
  }) => {
    setNumPages(loadedPageCount);
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

      const mappedSignatureType =
        signatureType === "drawn"
          ? "draw"
          : signatureType === "typed"
            ? "type"
            : "upload";

      return await submitPublicSigning(token, {
        status,
        signatureData: status === "signed" ? signatureData : undefined,
        signatureType: status === "signed" ? mappedSignatureType : undefined,
        ipAddress: clientIp,
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      track.signatureCompleted({
        documentId: doc._id,
        recipientId: recipient._id,
      });
      setShowSignatureCapture(false);
      if (isEmbedded) {
        postSealEvent("seal:signed", { token, recipientId: recipient._id });
      } else {
        toast.success("Document signed successfully!");
        window.location.reload();
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to save signature";
      if (isEmbedded) {
        postSealEvent("seal:error", { token, code: "SIGN_FAILED", message });
      }
      toast.error(message);
    },
  });

  // Handle signature capture
  const handleSignatureCapture = async (
    signatureData: string,
    signatureType: "drawn" | "typed" | "uploaded"
  ) => {
    submitSignatureMutation.mutate({ signatureData, signatureType });
  };

  const handleSignButtonClick = () => {
    // Check if all required fields are filled
    if (!allRequiredFieldsFilled) {
      const unfilledFields = requiredFields.filter((f) => !f.isFilled);
      toast.error(
        `Please fill all required fields first (${unfilledFields.length} remaining)`
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
      return await submitPublicSigning(token, {
        status: "declined",
        declineReason: reason,
        ipAddress: clientIp,
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      track.signatureDeclined({
        documentId: doc._id,
        recipientId: recipient._id,
      });
      setShowDeclineDialog(false);
      if (isEmbedded) {
        postSealEvent("seal:declined", { token, reason: declineReason });
      } else {
        toast.success("Document declined");
        window.location.reload();
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to decline document";
      if (isEmbedded) {
        postSealEvent("seal:error", { token, code: "DECLINE_FAILED", message });
      }
      toast.error(message);
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

  // Download signed PDF handler
  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      link.href = getPublicSigningSignedPdfUrl(token);
      link.download = `${doc.name || "document"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download document");
    } finally {
      setIsDownloading(false);
    }
  };

  // Field handling
  const handleFieldClick = (fieldId: string) => {
    setActiveFieldId(fieldId);
    setShowFieldInput(true);
  };

  const handleFieldSave = async (
    value?: string,
    signatureImageUrl?: string
  ) => {
    if (!activeFieldId || !activeField) return;

    await savePublicSigningFieldValue(token, activeField.publicId, {
      value,
      signatureImageUrl,
      signatureMethod: signatureImageUrl ? "draw" : undefined,
      ipAddress: clientIp,
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
  const mainSignatureField = fields.find((f) => f.isMainSignature);
  const isMainSignatureFilled = mainSignatureField?.isFilled || false;
  const unfilledRequiredCount =
    requiredFields.length - filledRequiredFields.length;

  // Check if recipient has already completed their action
  const isCompleted =
    recipient.status === "signed" ||
    recipient.status === "approved" ||
    recipient.status === "declined";

  const isSigningActionDisabled =
    isCompleted ||
    submitSignatureMutation.isPending ||
    hasUnpaidPayments ||
    !allRequiredFieldsFilled;
  const signingButtonLabel = useMemo(() => {
    if (hasUnpaidPayments) {
      return "Payment required";
    }
    if (!allRequiredFieldsFilled) {
      return `Please complete ${unfilledRequiredCount} more required field${unfilledRequiredCount === 1 ? "" : "s"}`;
    }
    if (mainSignatureField && isMainSignatureFilled) {
      return recipient.role === "signer"
        ? "Submit Signature"
        : recipient.role === "approver"
          ? "Submit Approval"
          : "Submit";
    }
    return recipient.role === "signer"
      ? "Sign Document"
      : recipient.role === "approver"
        ? "Approve Document"
        : "Mark as Viewed";
  }, [
    allRequiredFieldsFilled,
    hasUnpaidPayments,
    mainSignatureField,
    isMainSignatureFilled,
    recipient.role,
    unfilledRequiredCount,
  ]);
  const activeField = useMemo(
    () => (activeFieldId ? fields.find((f) => f._id === activeFieldId) : null),
    [activeFieldId, fields]
  );

  // Check if document is waiting for payment (all signed, payment pending)
  const isWaitingForPayment = doc.workflowStatus === "waiting_for_payment";

  // After page reloads with isCompleted=true, trigger the post-signing flow:
  // dictation first (if awaiting), then redirect (if configured), else standard thank-you.
  const postSigningTriggered = useRef(false);
  useEffect(() => {
    if (postSigningTriggered.current) return;
    if (!isCompleted || recipient.status === "declined") return;
    postSigningTriggered.current = true;
    if (recipient.awaitingDictation) {
      setShowDictateDialog(true);
    } else if (doc.redirectUrl) {
      setShowRedirect(true);
    }
  }, [
    isCompleted,
    recipient.status,
    recipient.awaitingDictation,
    doc.redirectUrl,
  ]);

  // Sort fields by page and position for navigation
  const sortedFields = [...fields].toSorted((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  // Get unfilled required fields for navigation
  const unfilledFields = sortedFields.filter((f) => !f.isFilled);

  // Scroll to field function
  const scrollToField = useCallback((fieldId: string) => {
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
    return undefined;
  }, [unfilledFields, isCompleted, scrollToField]);

  // State for collapsible sections on mobile
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const statusBadge = getStatusBadge(recipient.status);

  // Expiration gate — block access if recipient's deadline has passed
  if (recipient.expiresAt && recipient.expiresAt < Date.now()) {
    return <DocumentExpiredPage ownerName={doc.ownerName || ""} />;
  }

  const authMethod = recipient.authMethod ?? "none";
  if (
    !authVerified &&
    (authMethod === "email_otp" || authMethod === "access_code") &&
    !isCompleted
  ) {
    return (
      <SignerAuthGate
        token={token}
        method={authMethod}
        maskedEmail={recipient.authEmailMasked ?? null}
        onVerified={() => setAuthVerified(true)}
      />
    );
  }

  // Show waiting state for sequential signing when it's not this recipient's turn
  if (waitingForPreviousGroup && !isCompleted) {
    return (
      <div
        className="dark:bg-background bg-background flex h-dvh flex-col items-center justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="bg-kumo-warning-tint mx-auto flex size-16 items-center justify-center rounded-full">
            <Clock className="text-kumo-warning size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              Waiting for Previous Signers
            </h1>
            <p className="text-kumo-secondary text-sm text-pretty">
              This document uses sequential signing.{" "}
              {sequentialProgress
                ? `Group ${sequentialProgress.currentGroup} of ${sequentialProgress.totalGroups} is currently signing.`
                : "Previous recipients must complete their actions before you can proceed."}{" "}
              You'll be notified by email when it's your turn.
            </p>
          </div>
          <div className="bg-kumo-elevated rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <FileText className="text-kumo-secondary size-5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-kumo-secondary text-xs">
                  You're listed as a {recipient.role} on this document
                </p>
              </div>
            </div>
          </div>
          <p className="text-kumo-secondary text-xs">
            This page updates automatically. You can also close it and return
            via the link in your email.
          </p>
        </div>
      </div>
    );
  }

  // Show ESIGN consent modal before allowing document access
  // Skip for recipients who already consented or are in a terminal state
  if (!hasConsented && !isCompleted) {
    return (
      <EsignConsentDialog
        recipientEmail={recipient.email}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        onDownloadPdf={handleDownload}
        onOptOut={handleOptOut}
        isSubmitting={isConsentSubmitting}
        customConsentText={signingSettings?.esignConsentText}
      />
    );
  }

  // Build brand color CSS custom properties
  const brandStyle: React.CSSProperties = branding?.brandColor
    ? { "--brand-primary": branding.brandColor }
    : {};

  return (
    <div
      className="dark:bg-background bg-background flex h-dvh flex-col overflow-hidden"
      style={brandStyle}
      data-embedded={isEmbedded ? "true" : undefined}
    >
      <h1 className="sr-only">{doc.name} — Sign Document</h1>

      {/* Offline Banner - Global */}
      {!isOnline && (
        <div
          className="border-warning-surface bg-kumo-warning-tint fixed top-0 right-0 left-0 z-50 border-b px-4 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="text-kumo-warning flex items-center justify-center gap-2">
            <WifiSlash className="h-4 w-4" />
            <span className="text-sm font-medium">
              You're offline. Your progress has been saved.
            </span>
          </div>
        </div>
      )}

      {/* Desktop Header - Full width top bar (hidden in embedded mode) */}
      <header
        className={cn(
          "border-kumo-hairline/50 bg-kumo-elevated hidden shrink-0 border-b lg:block",
          isEmbedded && "!hidden"
        )}
      >
        <div className="flex h-14 items-center justify-between px-6">
          {/* Left: Logo + Document context */}
          <div className="flex items-center gap-4">
            <a
              href="/"
              aria-label="Go to sign-in page"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-8 max-w-[160px] object-contain"
                />
              ) : (
                <>
                  <SealLogo size={32} variant="color" />
                  <span className="font-semibold tracking-tight">Seal</span>
                </>
              )}
            </a>
            <div className="bg-border/60 h-5 w-px" />
            <div className="flex items-center gap-2">
              <Pen className="text-kumo-secondary h-4 w-4" />
              <span className="text-kumo-secondary text-sm">Sign</span>
              <span className="text-kumo-secondary/40">·</span>
              <span className="max-w-[300px] truncate text-sm font-medium">
                {doc.name}
              </span>
              {!isCompleted && (
                <>
                  <span className="text-kumo-secondary/40">·</span>
                  <span className="text-kumo-secondary max-w-[280px] truncate text-sm">
                    Your signature is needed — then you can close this tab
                  </span>
                </>
              )}
              {/* Completion status inline with document title */}
              {isCompleted && (
                <>
                  <span className="text-kumo-secondary/40">·</span>
                  <span
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-medium",
                      recipient.status === "declined"
                        ? "text-kumo-danger"
                        : "text-kumo-success"
                    )}
                  >
                    {recipient.status === "declined" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {recipient.status === "declined" ? "Declined" : "Completed"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Status badge + Progress (when applicable) */}
          <div className="flex items-center gap-4">
            {!isCompleted && fields.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-kumo-elevated h-1.5 w-20 overflow-hidden rounded-full">
                    <div
                      className="bg-kumo-primary h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${fieldCompletionPercent}%` }}
                    />
                  </div>
                  <span className="text-kumo-secondary text-xs font-medium tabular-nums">
                    {fieldCompletionPercent}%
                  </span>
                </div>
                <div className="bg-border/60 h-5 w-px" />
              </div>
            )}
            <span
              className={statusBadge.className}
              role="status"
              aria-live="polite"
            >
              {statusBadge.icon}
              {recipient.status.charAt(0).toUpperCase() +
                recipient.status.slice(1)}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Header - Only visible on small screens (hidden in embedded mode) */}
      <header
        className={cn(
          "border-kumo-hairline/50 bg-kumo-base/80 sticky top-0 z-40 border-b backdrop-blur-xl lg:hidden",
          isEmbedded && "!hidden"
        )}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <a
              href="/"
              aria-label="Go to sign-in page"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-8 max-w-[120px] object-contain"
                />
              ) : (
                <>
                  <SealLogo size={32} variant="color" />
                  <span className="text-sm font-semibold tracking-tight">
                    Seal
                  </span>
                </>
              )}
            </a>
            {!isCompleted && fields.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="bg-kumo-elevated h-1.5 w-16 overflow-hidden rounded-full">
                  <div
                    className="bg-kumo-primary h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${fieldCompletionPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">
                  {fieldCompletionPercent}%
                </span>
              </div>
            )}
            {/* Completion status on mobile header */}
            {isCompleted && (
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  recipient.status === "declined"
                    ? "text-kumo-danger"
                    : "text-kumo-success"
                )}
              >
                {recipient.status === "declined" ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                {recipient.status === "declined" ? "Declined" : "Completed"}
              </span>
            )}
          </div>
        </div>

        {/* Mobile Document Info - Collapsible */}
        <Collapsible.Root
          open={isInfoExpanded}
          onOpenChange={setIsInfoExpanded}
        >
          <Collapsible.Trigger
            aria-expanded={isInfoExpanded}
            aria-controls="signing-mobile-info"
            className="bg-kumo-elevated/30 border-kumo-hairline/30 hover:bg-kumo-elevated/50 flex w-full items-center justify-between border-t px-4 py-2.5 transition-colors"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="truncate text-sm font-medium">{doc.name}</span>
              <span
                className={statusBadge.className}
                role="status"
                aria-live="polite"
              >
                {statusBadge.icon}
                {recipient.status.charAt(0).toUpperCase() +
                  recipient.status.slice(1)}
              </span>
            </div>
            {isInfoExpanded ? (
              <CaretUp className="text-kumo-secondary h-4 w-4 shrink-0" />
            ) : (
              <CaretDown className="text-kumo-secondary h-4 w-4 shrink-0" />
            )}
          </Collapsible.Trigger>
          <Collapsible.Panel
            id="signing-mobile-info"
            className="border-kumo-hairline/30 bg-kumo-elevated border-t"
          >
            <div className="space-y-4 px-4 py-4">
              {doc.description && (
                <p className="text-kumo-secondary text-sm">{doc.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-kumo-secondary text-xs tracking-wider uppercase">
                    Recipient
                  </span>
                  <p className="truncate font-medium">
                    {recipient.name || recipient.email}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-kumo-secondary text-xs tracking-wider uppercase">
                    Role
                  </span>
                  <p className="flex items-center gap-1.5 font-medium">
                    {getRoleIcon(recipient.role)}
                    {recipient.role.charAt(0).toUpperCase() +
                      recipient.role.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      </header>

      {/* Main Layout - Side by side on desktop */}
      <div className="min-h-0 flex-1 overflow-hidden lg:flex">
        {/* Right Sidebar - Document Info (Desktop only) - Uses order-2 to appear on right */}
        <aside className="border-kumo-hairline/50 bg-kumo-elevated hidden overflow-hidden lg:order-2 lg:flex lg:w-[380px] lg:flex-col lg:border-l xl:w-[420px]">
          {/* Sidebar Header - Document Details */}
          {doc.description && (
            <div className="border-kumo-hairline/50 border-b p-6">
              <h3 className="text-kumo-secondary mb-2 text-xs font-medium tracking-wider uppercase">
                About this document
              </h3>
              <p className="text-kumo-secondary text-sm leading-relaxed">
                {doc.description}
              </p>
            </div>
          )}

          {/* Sidebar Content - Scrollable */}
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* Progress Section - Only when not completed and has fields */}
            {!isCompleted && fields.length > 0 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-kumo-secondary text-xs font-medium tracking-wider uppercase">
                      Progress
                    </h3>
                    <span className="text-sm font-medium tabular-nums">
                      {filledRequiredFields.length}/{requiredFields.length}
                    </span>
                  </div>
                  <div
                    className="bg-kumo-elevated h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={fieldCompletionPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Field completion progress"
                  >
                    <div
                      className="bg-kumo-primary h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${fieldCompletionPercent}%` }}
                    />
                  </div>
                  {!allRequiredFieldsFilled && (
                    <p className="text-kumo-secondary text-xs">
                      Complete all required fields to sign
                    </p>
                  )}
                </div>
                <hr className="border-kumo-hairline" />
              </>
            )}

            {/* Recipient Info */}
            <div className="space-y-4">
              <h3 className="text-kumo-secondary text-xs font-medium tracking-wider uppercase">
                Recipient Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-kumo-elevated flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <User className="text-kumo-secondary h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {recipient.name || "Not provided"}
                    </p>
                    <p className="text-kumo-secondary truncate text-xs">
                      {recipient.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="bg-kumo-elevated flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    {getRoleIcon(recipient.role)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {recipient.role.charAt(0).toUpperCase() +
                        recipient.role.slice(1)}
                    </p>
                    <p className="text-kumo-secondary text-xs">Assigned role</p>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-kumo-hairline" />

            {/* Timeline / Activity */}
            <div className="space-y-4">
              <h3 className="text-kumo-secondary text-xs font-medium tracking-wider uppercase">
                Activity
              </h3>
              <div className="space-y-3">
                {recipient.signedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-kumo-success-tint flex h-8 w-8 items-center justify-center rounded-full">
                      <CheckCircle className="text-kumo-success h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Signed</p>
                      <p className="text-kumo-secondary text-xs">
                        {formatDate(recipient.signedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.approvedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-kumo-success-tint flex h-8 w-8 items-center justify-center rounded-full">
                      <ShieldCheck className="text-kumo-success h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Approved</p>
                      <p className="text-kumo-secondary text-xs">
                        {formatDate(recipient.approvedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.declinedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-kumo-danger/10 flex h-8 w-8 items-center justify-center rounded-full">
                      <XCircle className="text-kumo-danger h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Declined</p>
                      <p className="text-kumo-secondary text-xs">
                        {formatDate(recipient.declinedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.viewedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-kumo-info-tint flex h-8 w-8 items-center justify-center rounded-full">
                      <Clock className="text-kumo-info h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Viewed</p>
                      <p className="text-kumo-secondary text-xs">
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
                      <div className="bg-kumo-warning-tint flex h-8 w-8 items-center justify-center rounded-full">
                        <Clock className="text-kumo-warning h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">Pending</p>
                        <p className="text-kumo-secondary text-xs">
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
                  <hr className="border-kumo-hairline" />
                  <div className="border-info-surface bg-kumo-info-tint/50 rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <PlayCircle className="text-kumo-info mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-kumo-primary text-sm font-medium">
                          Resume where you left off
                        </p>
                        <p className="text-kumo-secondary mt-0.5 text-xs">
                          {filledRequiredFields.length} of{" "}
                          {requiredFields.length} fields completed
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-kumo-info hover:bg-kumo-info-tint mt-2 h-8 px-0"
                          onClick={() => {
                            if (unfilledFields.length > 0) {
                              scrollToField(
                                sealAssertPresent(unfilledFields[0])._id
                              );
                            }
                          }}
                          aria-label="Jump to the next incomplete field"
                        >
                          Continue
                          <ArrowDown className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}

            {/* Payment Section — shown before signing when payment is required */}
            {!isCompleted && hasUnpaidPayments && paymentConfigs.length > 0 && (
              <>
                <hr className="border-kumo-hairline" />
                <div className="space-y-4">
                  <div className="border-warning-surface bg-kumo-warning-tint/50 rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard className="text-kumo-warning mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-kumo-primary text-sm font-medium">
                          Payment Required
                        </p>
                        <p className="text-kumo-secondary mt-0.5 text-xs">
                          Please complete payment below before signing.
                        </p>
                      </div>
                    </div>
                  </div>
                  {paymentConfigs
                    .filter(
                      (c) =>
                        c.paymentStatus !== "paid" &&
                        c.paymentStatus !== "cancelled"
                    )
                    .map((config) => (
                      <div
                        key={config._id}
                        className="border-kumo-hairline/50 bg-kumo-elevated/20 rounded-lg border p-3"
                      >
                        <p className="text-kumo-primary text-sm font-medium">
                          {config.paymentType}
                        </p>
                        <p className="text-kumo-secondary mt-0.5 text-xs">
                          {formatMoney(
                            money(
                              config.totalAmountCents,
                              (config.currency || "usd").toUpperCase()
                            )
                          )}{" "}
                          - {config.paymentStatus || "pending"}
                        </p>
                      </div>
                    ))}
                </div>
              </>
            )}

            {/* Payment Section — shown after signing when document is waiting for payment */}
            {isCompleted &&
              isWaitingForPayment &&
              paymentConfigs.length > 0 && (
                <>
                  <hr className="border-kumo-hairline" />
                  <div className="space-y-4">
                    <div className="border-warning-surface bg-kumo-warning-tint/50 rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <CreditCard className="text-kumo-warning mt-0.5 h-5 w-5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-kumo-primary text-sm font-medium">
                            Payment Required
                          </p>
                          <p className="text-kumo-secondary mt-0.5 text-xs">
                            All signatures collected. Please complete payment
                            below.
                          </p>
                        </div>
                      </div>
                    </div>
                    {paymentConfigs
                      .filter(
                        (c) =>
                          c.paymentStatus !== "paid" &&
                          c.paymentStatus !== "cancelled"
                      )
                      .map((config) => (
                        <div
                          key={config._id}
                          className="border-kumo-hairline/50 bg-kumo-elevated/20 rounded-lg border p-3"
                        >
                          <p className="text-kumo-primary text-sm font-medium">
                            {config.paymentType}
                          </p>
                          <p className="text-kumo-secondary mt-0.5 text-xs">
                            {formatMoney(
                              money(
                                config.totalAmountCents,
                                (config.currency || "usd").toUpperCase()
                              )
                            )}{" "}
                            - {config.paymentStatus || "pending"}
                          </p>
                        </div>
                      ))}
                  </div>
                </>
              )}
          </div>

          {/* Sidebar Footer - Actions */}
          {!isCompleted && !showSignatureCapture && (
            <div className="border-kumo-hairline/50 bg-kumo-elevated/20 border-t p-6">
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="h-12 w-full text-base font-medium shadow-sm transition-shadow hover:shadow"
                  style={
                    branding?.brandColor
                      ? {
                          backgroundColor: branding.brandColor,
                          borderColor: branding.brandColor,
                        }
                      : undefined
                  }
                  onClick={handleSignButtonClick}
                  disabled={isSigningActionDisabled}
                  aria-label={signingButtonLabel}
                >
                  {submitSignatureMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Pen className="mr-2 h-4 w-4" />
                      {signingButtonLabel}
                    </>
                  )}
                </Button>
                {!(isEmbedded && embedParams.hideDecline) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-kumo-secondary hover:text-kumo-primary w-full"
                    onClick={handleDeclineClick}
                    disabled={declineMutation.isPending}
                    aria-label="Open decline confirmation"
                  >
                    Decline to sign
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completed state footer */}
          {isCompleted && recipient.status !== "declined" && (
            <div className="border-kumo-hairline/50 bg-kumo-success-tint/30 space-y-4 border-t p-6">
              <div className="text-kumo-success flex flex-col items-center gap-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    {recipient.status === "approved"
                      ? "Document Approved"
                      : "Document Signed"}
                  </span>
                </div>
                <p className="text-kumo-secondary text-sm">
                  You&apos;re done — you can close this tab. The agent will
                  continue.
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full"
                onClick={handleDownload}
                disabled={isDownloading}
                aria-label="Download the signed document"
              >
                {isDownloading ? (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isDownloading ? "Preparing..." : "Download Document"}
              </Button>
              {showRedirect && doc.redirectUrl && (
                <RedirectCountdown
                  redirectUrl={doc.redirectUrl}
                  recipientEmail={recipient.email}
                  recipientName={recipient.name ?? recipient.email}
                  onStayHere={() => setShowRedirect(false)}
                />
              )}
            </div>
          )}
        </aside>

        {/* Main Content Area - PDF Viewer (now on left with order-1) */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:order-1">
          {/* Field Navigation Bar */}
          {!isCompleted && fields.length > 0 && (
            <div className="border-kumo-hairline/50 bg-kumo-base/80 sticky top-0 z-30 border-b px-4 py-2.5 backdrop-blur-xl lg:top-0">
              <div className="mx-auto flex max-w-4xl items-center justify-between">
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="flex items-center gap-2">
                    <div className="bg-kumo-elevated h-1.5 w-24 overflow-hidden rounded-full">
                      <div
                        className="bg-kumo-primary h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{ width: `${fieldCompletionPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {fieldCompletionPercent}%
                    </span>
                  </div>
                  <span className="text-kumo-secondary text-sm">
                    {filledRequiredFields.length} of {requiredFields.length}{" "}
                    fields
                  </span>
                </div>

                <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-end">
                  {unfilledFields.length > 0 ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={navigateToPreviousField}
                        disabled={unfilledFields.length <= 1}
                        aria-label="Navigate to previous required field"
                      >
                        <ArrowUp className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Prev</span>
                      </Button>
                      <span className="text-kumo-secondary min-w-[60px] px-2 text-center text-sm tabular-nums">
                        {currentFieldIndex + 1} / {unfilledFields.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={navigateToNextField}
                        disabled={unfilledFields.length <= 1}
                        aria-label="Navigate to next required field"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ArrowDown className="h-4 w-4 sm:ml-1" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-kumo-success animate-in fade-in slide-in-from-bottom-1 flex items-center gap-2 duration-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-semibold">
                        All fields completed — ready to sign
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
            className="bg-kumo-elevated dark:bg-kumo-elevated/30 flex-1 overflow-auto"
          >
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-4xl">
                {/* Page count header */}
                {numPages && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-kumo-secondary flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      <span>
                        {numPages} page{numPages > 1 ? "s" : ""}
                      </span>
                    </div>
                    {numPages > 1 && (
                      <span className="text-kumo-secondary text-xs">
                        Scroll to view all pages
                      </span>
                    )}
                  </div>
                )}

                {/* PDF Document */}
                {pdfUrl ? (
                  <div className="space-y-4">
                    <PdfSigningDocumentSurface
                      src={pdfUrl}
                      width={pdfWidth}
                      onDocumentLoadSuccess={onDocumentLoadSuccess}
                      renderPageOverlays={({
                        pageNumber,
                        pageWidth,
                        pageHeight,
                      }) => {
                        const fieldsOnPage = fields.filter(
                          (f) => f.page === pageNumber
                        );
                        return (
                          <>
                            {fieldsOnPage.map((field) => (
                              <FillableFieldOverlay
                                key={field._id}
                                ref={(el: HTMLButtonElement | null) => {
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
                                pdfPageWidth={pageWidth}
                                pdfPageHeight={pageHeight}
                                isFilled={field.isFilled}
                                isActive={
                                  !isCompleted && activeFieldId === field._id
                                }
                                signatureDetails={field.signatureDetails}
                                paymentInfo={paymentInfoByFieldId.get(
                                  field._id
                                )}
                                onClick={
                                  isCompleted ? () => {} : handleFieldClick
                                }
                              />
                            ))}
                          </>
                        );
                      }}
                    />

                    {/* Signature Stamp - shown when document is completed with no positioned fields */}
                    {isCompleted &&
                      fields.length === 0 &&
                      recipient.status === "signed" && (
                        <div className="border-kumo-hairline/50 bg-kumo-elevated mx-auto mt-4 max-w-md rounded-lg border p-4 shadow-sm">
                          <div className="border-kumo-hairline overflow-hidden rounded-md border">
                            {/* Signature details stamp - Name, date and time only */}
                            <div className="bg-kumo-elevated px-4 py-4">
                              <div className="text-kumo-success mb-3 flex items-center gap-2">
                                <CheckCircle className="h-6 w-6" />
                                <span className="text-lg font-medium">
                                  Document Signed
                                </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-kumo-secondary text-sm">
                                    Signed by:
                                  </span>
                                  <span className="text-kumo-primary text-sm font-semibold">
                                    {recipient.name || recipient.email}
                                  </span>
                                </div>
                                {recipient.signedAt && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-kumo-secondary text-sm">
                                      Date:
                                    </span>
                                    <span className="text-kumo-primary text-sm">
                                      {new Date(
                                        recipient.signedAt
                                      ).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}{" "}
                                      at{" "}
                                      {new Date(
                                        recipient.signedAt
                                      ).toLocaleTimeString(undefined, {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="border-kumo-hairline/50 bg-kumo-elevated rounded-lg border p-16 text-center shadow-sm">
                    <div className="animate-pulse space-y-4">
                      <div className="bg-kumo-elevated mx-auto h-4 w-1/3 rounded" />
                      <div className="bg-kumo-elevated mx-auto h-4 w-1/2 rounded" />
                      <div className="bg-kumo-elevated mx-auto h-4 w-2/5 rounded" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Action Bar - Fixed at bottom on mobile */}
          {!isCompleted && !showSignatureCapture && (
            <div
              className={cn(
                "border-kumo-hairline/50 bg-kumo-base/95 sticky bottom-0 z-40 border-t p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden",
                isEmbedded && "!block"
              )}
            >
              <div className="flex gap-3">
                {!(isEmbedded && embedParams.hideDecline) && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 flex-1"
                    onClick={handleDeclineClick}
                    disabled={declineMutation.isPending}
                    aria-label="Decline document"
                  >
                    Decline
                  </Button>
                )}
                <Button
                  size="lg"
                  className="h-12 flex-1 font-medium"
                  onClick={handleSignButtonClick}
                  disabled={isSigningActionDisabled}
                  aria-label={signingButtonLabel}
                >
                  {submitSignatureMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      {recipient.role === "signer" && (
                        <Pen className="mr-2 h-4 w-4" />
                      )}
                      {signingButtonLabel}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Mobile Completed Footer */}
          {isCompleted && (
            <div className="border-kumo-hairline/50 bg-kumo-base/95 sticky bottom-0 z-40 border-t p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
              {recipient.status !== "declined" ? (
                <div className="space-y-3">
                  <div className="text-kumo-success flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs font-semibold">
                      {recipient.status === "approved" ? "Approved" : "Signed"}{" "}
                      successfully
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    aria-label="Download the final signed document"
                  >
                    {isDownloading ? (
                      <Spinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isDownloading ? "Preparing..." : "Download Document"}
                  </Button>
                </div>
              ) : (
                <p className="text-kumo-secondary text-center text-sm">
                  You have declined this document.
                </p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Signature Capture Modal */}
      <Dialog.Root
        open={!isCompleted && showSignatureCapture}
        onOpenChange={(open: boolean) => !open && handleCancelSignature()}
      >
        <Dialog size="xl" className="gap-0 overflow-hidden p-0">
          <Dialog.Title className="sr-only">Sign Document</Dialog.Title>
          <SignatureCapture
            recipientName={recipient.name || ""}
            onSignatureCapture={handleSignatureCapture}
            onCancel={handleCancelSignature}
            allowedSignatureTypes={undefined}
          />
        </Dialog>
      </Dialog.Root>

      {/* Decline Dialog */}
      <Dialog.Root open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Decline Document</Dialog.Title>
          <Dialog.Description>
            Please provide a reason for declining. This will be shared with the
            document sender.
          </Dialog.Description>
          <div className="space-y-2 py-4">
            <Label htmlFor="decline-reason">Reason</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDeclineReason(e.target.value)
              }
              placeholder="Enter your reason here..."
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
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
              className="sm:ml-auto"
            >
              {declineMutation.isPending ? "Declining..." : "Decline"}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Dictate Next Signer Dialog */}
      <DictateNextSignerDialog
        open={showDictateDialog}
        signingToken={token}
        onSuccess={() => {
          setShowDictateDialog(false);
          if (doc.redirectUrl) setShowRedirect(true);
        }}
        onDefer={() => {
          setShowDictateDialog(false);
          if (doc.redirectUrl) setShowRedirect(true);
        }}
      />

      {/* Field Input Manager */}
      {activeField && (
        <FieldInputManager
          open={showFieldInput}
          onOpenChange={setShowFieldInput}
          fieldId={activeField._id}
          fieldType={activeField.fieldType || "text"}
          label={capitalizeFieldLabel(activeField.label || "")}
          isRequired={activeField.isRequired || false}
          currentValue={activeField.currentValue ?? undefined}
          currentSignatureImageUrl={
            activeField.currentSignatureImageUrl ?? undefined
          }
          properties={asFieldProperties(activeField.properties)}
          validationRules={asFieldValidationRules(activeField.validationRules)}
          onSave={handleFieldSave}
          recipientName={recipient.name || recipient.email}
          signingToken={token}
        />
      )}

      {/* Branding footer (hidden in embedded mode) */}
      {!isEmbedded && !branding?.hideSealBranding && (
        <div className="border-kumo-hairline/50 text-kumo-secondary hidden shrink-0 border-t py-2 text-center text-xs lg:block">
          {branding?.customFooterText || (
            <a
              href="https://seal.nyc"
              rel="noopener noreferrer"
              className="hover:text-kumo-primary transition-colors"
            >
              Powered by Seal
            </a>
          )}
        </div>
      )}
      {!isEmbedded &&
        branding?.hideSealBranding &&
        branding?.customFooterText && (
          <div className="border-kumo-hairline/50 text-kumo-secondary hidden shrink-0 border-t py-2 text-center text-xs lg:block">
            {branding.customFooterText}
          </div>
        )}
    </div>
  );
}
