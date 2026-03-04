/**
 * Public Signing Page
 * Route: /sign/$token
 *
 * Allows recipients to view and sign documents using their unique signing token.
 * This is an unauthenticated route - no Clerk login required.
 */

import { convexQuery } from "@convex-dev/react-query";
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
  CreditCardIcon,
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  PenLineIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  UserIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";

import { EsignConsentDialog } from "@/components/documents/esign-consent-dialog";
import { FieldInputManager } from "@/components/documents/field-input-manager";
import { PaymentFieldSummary } from "@/components/documents/field-inputs";
import { FillableFieldOverlay } from "@/components/documents/fillable-field-overlay";
import { SignatureCapture } from "@/components/documents/signature-capture";
import { SealLogo } from "@/components/seal-logo";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { DictateNextSignerDialog } from "@/components/signing/dictate-next-signer-dialog";
import { DocumentExpiredPage } from "@/components/signing/document-expired-page";
import { RedirectCountdown } from "@/components/signing/redirect-countdown";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { useAnalytics } from "@/hooks/use-analytics";
import { pageSEO } from "@/lib/seo";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Embedded Signing (iFrame SDK) ──────────────────────────────────
type SealEventType = "seal:ready" | "seal:viewed" | "seal:signed" | "seal:declined" | "seal:error";

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
    if (!isEmbedded) return;
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

export const Route = createFileRoute("/sign/$token")({
  component: SigningPage,
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

function SigningPage() {
  const { token } = Route.useParams();
  const { convexClient } = useRouteContext({ from: "__root__" });
  const { track } = useAnalytics();
  const { isEmbedded, embedParams } = useEmbeddedSigning(token);

  // Fetch recipient and document data using the signing token
  const { data } = useSuspenseQuery(
    convexQuery(api.documents.recipients_queries.getRecipientByToken, {
      signingToken: token,
    }),
  );

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

  // Fetch fields assigned to this recipient
  const { data: fields = [], refetch: refetchFields } = useSuspenseQuery(
    convexQuery(api.signature_fields.queries.getFieldsBySigningToken, {
      signingToken: token,
    }),
  );

  // Load payment configs for payment field overlays
  const { data: paymentConfigs = [] } = useSuspenseQuery(
    convexQuery(api.payment_fields.queries.getPaymentConfigsByDocument, {
      documentId: doc._id,
    }),
  );

  const paymentInfoByFieldId = useMemo(() => {
    const map = new Map<
      string,
      { totalAmountCents: number; currency: string; paymentStatus?: string }
    >();
    for (const config of paymentConfigs) {
      map.set(config.fieldId, {
        totalAmountCents: config.totalAmountCents,
        currency: config.currency,
        paymentStatus: config.paymentStatus,
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
  const [pdfPageDimensions, setPdfPageDimensions] = useState<
    Map<number, { width: number; height: number }>
  >(new Map());

  // Field input state
  const [activeFieldId, setActiveFieldId] = useState<Id<"signature_fields"> | null>(null);
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

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Post-signing flow: dictation and redirect
  const [showDictateDialog, setShowDictateDialog] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);

  // Client IP for audit trail (fetched from Convex HTTP endpoint)
  const [clientIp, setClientIp] = useState("unknown");
  useEffect(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
    if (!convexUrl) return;
    const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
    fetch(`${siteUrl}/api/v1/ip`)
      .then((res) => res.json())
      .then((data: { ip: string }) => setClientIp(data.ip))
      .catch(() => {
        // Silently fall back to "unknown" — IP is best-effort
      });
  }, []);

  // ESIGN consent handlers
  const handleConsentAccept = useCallback(async () => {
    setIsConsentSubmitting(true);
    try {
      await convexClient.mutation(api.documents.recipients_mutations.recordEsignConsent, {
        signingToken: token,
        ipAddress: clientIp,
        consentVersion: "1.0",
      });
      setHasConsented(true);
      if (isEmbedded) {
        postSealEvent("seal:viewed", { token });
      }
    } catch (error) {
      toast.error("Failed to record consent. Please try again.");
      console.error("ESIGN consent error:", error);
    } finally {
      setIsConsentSubmitting(false);
    }
  }, [convexClient, token, clientIp, isEmbedded]);

  const handleConsentDecline = useCallback(() => {
    // The decline state is handled inside the consent dialog component.
    // If the user truly wants to leave, they navigate away themselves.
  }, []);

  const handleOptOut = useCallback(
    async (method: string) => {
      try {
        await convexClient.mutation(api.documents.recipients_mutations.recordEsignOptOut, {
          signingToken: token,
          ipAddress: clientIp,
          method,
        });
      } catch (error) {
        // Opt-out logging is best-effort — don't block the user's action
        console.error("Failed to log opt-out:", error);
      }
    },
    [convexClient, token, clientIp],
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
        const url = await convexClient.query(api.documents.queries.getDocumentUrlByToken, {
          signingToken: token,
        });
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
          await convexClient.mutation(api.documents.recipients_mutations.submitRecipientSignature, {
            signingToken: token,
            status: "viewed",
            ipAddress: clientIp,
          });
        } catch (error) {
          // Silent failure - viewing tracking is not critical
          console.error("Failed to track document view:", error);
        }
      }
    };
    markAsViewed();
  }, [convexClient, token, recipient.status, clientIp]);

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
          ipAddress: clientIp,
        },
      );
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
      const message = error instanceof Error ? error.message : "Failed to save signature";
      if (isEmbedded) {
        postSealEvent("seal:error", { token, code: "SIGN_FAILED", message });
      }
      toast.error(message);
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
      toast.error(`Please fill all required fields first (${unfilledFields.length} remaining)`);
      return;
    }

    // If the main signature field is already filled, submit directly
    if (mainSignatureField?.fieldType === "signature" && isMainSignatureFilled) {
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
          ipAddress: clientIp,
        },
      );
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
      const message = error instanceof Error ? error.message : "Failed to decline document";
      if (isEmbedded) {
        postSealEvent("seal:error", { token, code: "DECLINE_FAILED", message });
      }
      toast.error(message);
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

  // Download signed PDF handler
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { url, documentName } = await convexClient.action(
        api.documents.sign_pdf_action.generateAndGetSignedPdfByToken,
        { signingToken: token },
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentName || "document"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error) {
      console.error("Failed to download document:", error);
      toast.error("Failed to download document");
    } finally {
      setIsDownloading(false);
    }
  };

  // Field handling
  const handleFieldClick = (fieldId: Id<"signature_fields">) => {
    setActiveFieldId(fieldId);
    setShowFieldInput(true);
  };

  const handleFieldSave = async (value?: string, signatureImageUrl?: string) => {
    if (!activeFieldId) return;

    await convexClient.mutation(api.signatures.mutations.saveFieldValue, {
      signingToken: token,
      fieldId: activeFieldId,
      value,
      signatureImageUrl,
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
  const mainSignatureField = fields.find((f) => f.isMainSignature === true);
  const isMainSignatureFilled = mainSignatureField?.isFilled || false;

  // Check if recipient has already completed their action
  const isCompleted =
    recipient.status === "signed" ||
    recipient.status === "approved" ||
    recipient.status === "declined";

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
  }, [isCompleted, recipient.status, recipient.awaitingDictation, doc.redirectUrl]);

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

    const prevIndex = currentFieldIndex === 0 ? unfilledFields.length - 1 : currentFieldIndex - 1;
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
          className: `${baseStyles} bg-success-surface text-success`,
          icon: <CheckCircle2Icon className="h-3 w-3" />,
        };
      case "declined":
        return {
          className: `${baseStyles} bg-destructive/10 text-destructive`,
          icon: <XCircleIcon className="h-3 w-3" />,
        };
      case "viewed":
        return {
          className: `${baseStyles} bg-info-surface text-info`,
          icon: <ClockIcon className="h-3 w-3" />,
        };
      default:
        return {
          className: `${baseStyles} bg-warning-surface text-warning`,
          icon: <ClockIcon className="h-3 w-3" />,
        };
    }
  };

  const statusBadge = getStatusBadge(recipient.status);

  // Expiration gate — block access if recipient's deadline has passed
  if (recipient.expiresAt && recipient.expiresAt < Date.now()) {
    return <DocumentExpiredPage ownerName={data.ownerName} />;
  }

  // Show waiting state for sequential signing when it's not this recipient's turn
  if (waitingForPreviousGroup && !isCompleted) {
    return (
      <div className="dark:bg-background flex h-dvh flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-surface">
            <ClockIcon className="size-8 text-warning" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              Waiting for Previous Signers
            </h1>
            <p className="text-muted-foreground text-sm text-pretty">
              This document uses sequential signing.{" "}
              {sequentialProgress
                ? `Group ${sequentialProgress.currentGroup} of ${sequentialProgress.totalGroups} is currently signing.`
                : "Previous recipients must complete their actions before you can proceed."}{" "}
              You'll be notified by email when it's your turn.
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <FileTextIcon className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-muted-foreground text-xs">
                  You're listed as a {recipient.role} on this document
                </p>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            This page updates automatically. You can also close it and return via the link in your
            email.
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
    ? ({ "--brand-primary": branding.brandColor } as React.CSSProperties)
    : {};

  return (
    <div
      className="dark:bg-background flex h-screen flex-col overflow-hidden bg-background"
      style={brandStyle}
      data-embedded={isEmbedded ? "true" : undefined}
    >
      {/* Offline Banner - Global */}
      {!isOnline && (
        <div className="fixed top-0 right-0 left-0 z-50 border-b border-warning-surface bg-warning-surface px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-warning-foreground">
            <WifiOffIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              You're offline. Your progress has been saved.
            </span>
          </div>
        </div>
      )}

      {/* Desktop Header - Full width top bar (hidden in embedded mode) */}
      <header
        className={`border-border/50 dark:bg-card hidden shrink-0 border-b bg-white lg:block ${isEmbedded ? "!hidden" : ""}`}
      >
        <div className="flex h-14 items-center justify-between px-6">
          {/* Left: Logo + Document context */}
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
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
              <PenLineIcon className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-sm">Sign</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="max-w-[300px] truncate text-sm font-medium">{doc.name}</span>
              {/* Completion status inline with document title */}
              {isCompleted && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      recipient.status === "declined"
                        ? "text-destructive"
                        : "text-success"
                    }`}
                  >
                    {recipient.status === "declined" ? (
                      <XCircleIcon className="h-4 w-4" />
                    ) : (
                      <CheckCircleIcon className="h-4 w-4" />
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
                  <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${fieldCompletionPercent}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs font-medium tabular-nums">
                    {fieldCompletionPercent}%
                  </span>
                </div>
                <div className="bg-border/60 h-5 w-px" />
              </div>
            )}
            <span className={statusBadge.className}>
              {statusBadge.icon}
              {recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Header - Only visible on small screens (hidden in embedded mode) */}
      <header
        className={`dark:bg-background/80 border-border/50 sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl lg:hidden ${isEmbedded ? "!hidden" : ""}`}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-8 max-w-[120px] object-contain"
                />
              ) : (
                <>
                  <SealLogo size={32} variant="color" />
                  <span className="text-sm font-semibold tracking-tight">Seal</span>
                </>
              )}
            </a>
            {!isCompleted && fields.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${fieldCompletionPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">{fieldCompletionPercent}%</span>
              </div>
            )}
            {/* Completion status on mobile header */}
            {isCompleted && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  recipient.status === "declined"
                    ? "text-destructive"
                    : "text-success"
                }`}
              >
                {recipient.status === "declined" ? (
                  <XCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                )}
                {recipient.status === "declined" ? "Declined" : "Completed"}
              </span>
            )}
          </div>
        </div>

        {/* Mobile Document Info - Collapsible */}
        <Collapsible open={isInfoExpanded} onOpenChange={setIsInfoExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="bg-muted/30 border-border/30 hover:bg-muted/50 flex w-full items-center justify-between border-t px-4 py-2.5 transition-colors"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="truncate text-sm font-medium">{doc.name}</span>
                <span className={statusBadge.className}>
                  {statusBadge.icon}
                  {recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                </span>
              </div>
              {isInfoExpanded ? (
                <ChevronUpIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              ) : (
                <ChevronDownIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="dark:bg-card border-border/30 border-t bg-white">
            <div className="space-y-4 px-4 py-4">
              {doc.description && (
                <p className="text-muted-foreground text-sm">{doc.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs tracking-wider uppercase">
                    Recipient
                  </span>
                  <p className="truncate font-medium">{recipient.name || recipient.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs tracking-wider uppercase">
                    Role
                  </span>
                  <p className="flex items-center gap-1.5 font-medium">
                    {getRoleIcon(recipient.role)}
                    {recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </header>

      {/* Main Layout - Side by side on desktop */}
      <div className="min-h-0 flex-1 overflow-hidden lg:flex">
        {/* Right Sidebar - Document Info (Desktop only) - Uses order-2 to appear on right */}
        <aside className="border-border/50 dark:bg-card hidden overflow-hidden bg-white lg:order-2 lg:flex lg:w-[380px] lg:flex-col lg:border-l xl:w-[420px]">
          {/* Sidebar Header - Document Details */}
          {doc.description && (
            <div className="border-border/50 border-b p-6">
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                About this document
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{doc.description}</p>
            </div>
          )}

          {/* Sidebar Content - Scrollable */}
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* Progress Section - Only when not completed and has fields */}
            {!isCompleted && fields.length > 0 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Progress
                    </h3>
                    <span className="text-sm font-medium tabular-nums">
                      {filledRequiredFields.length}/{requiredFields.length}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="from-primary to-primary/80 h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out"
                      style={{ width: `${fieldCompletionPercent}%` }}
                    />
                  </div>
                  {!allRequiredFieldsFilled && (
                    <p className="text-muted-foreground text-xs">
                      Complete all required fields to sign
                    </p>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Recipient Info */}
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Recipient Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <UserIcon className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {recipient.name || "Not provided"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{recipient.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    {getRoleIcon(recipient.role)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}
                    </p>
                    <p className="text-muted-foreground text-xs">Assigned role</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline / Activity */}
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Activity
              </h3>
              <div className="space-y-3">
                {recipient.signedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-surface">
                      <CheckCircle2Icon className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Signed</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(recipient.signedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.approvedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-surface">
                      <ShieldCheckIcon className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Approved</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(recipient.approvedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.declinedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                      <XCircleIcon className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium">Declined</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(recipient.declinedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {recipient.viewedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info-surface">
                      <ClockIcon className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <p className="font-medium">Viewed</p>
                      <p className="text-muted-foreground text-xs">
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-surface">
                        <ClockIcon className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium">Pending</p>
                        <p className="text-muted-foreground text-xs">Awaiting your action</p>
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
                  <div className="rounded-xl border border-info-surface bg-info-surface/50 p-4">
                    <div className="flex items-start gap-3">
                      <PlayCircleIcon className="text-info mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-medium">
                          Resume where you left off
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {filledRequiredFields.length} of {requiredFields.length} fields completed
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-info hover:bg-info-surface mt-2 h-8 px-0"
                          onClick={() => {
                            if (unfilledFields.length > 0) {
                              scrollToField(unfilledFields[0]._id);
                            }
                          }}
                        >
                          Continue
                          <ArrowDownIcon className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}

            {/* Payment Section — shown before signing when payment is required */}
            {!isCompleted && hasUnpaidPayments && paymentConfigs.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="rounded-xl border border-warning-surface bg-warning-surface/50 p-4">
                    <div className="flex items-start gap-3">
                      <CreditCardIcon className="text-warning mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-medium">
                          Payment Required
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Please complete payment below before signing.
                        </p>
                      </div>
                    </div>
                  </div>
                  {paymentConfigs
                    .filter((c) => c.paymentStatus !== "paid" && c.paymentStatus !== "cancelled")
                    .map((config) => (
                      <PaymentFieldSummary
                        key={config._id}
                        fieldId={config.fieldId}
                        token={token}
                        showInlinePayment
                      />
                    ))}
                </div>
              </>
            )}

            {/* Payment Section — shown after signing when document is waiting for payment */}
            {isCompleted && isWaitingForPayment && paymentConfigs.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="rounded-xl border border-warning-surface bg-warning-surface/50 p-4">
                    <div className="flex items-start gap-3">
                      <CreditCardIcon className="text-warning mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-medium">
                          Payment Required
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          All signatures collected. Please complete payment below.
                        </p>
                      </div>
                    </div>
                  </div>
                  {paymentConfigs
                    .filter((c) => c.paymentStatus !== "paid" && c.paymentStatus !== "cancelled")
                    .map((config) => (
                      <PaymentFieldSummary
                        key={config._id}
                        fieldId={config.fieldId}
                        token={token}
                        showInlinePayment
                      />
                    ))}
                </div>
              </>
            )}
          </div>

          {/* Sidebar Footer - Actions */}
          {!isCompleted && !showSignatureCapture && (
            <div className="border-border/50 bg-muted/20 border-t p-6">
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="h-12 w-full text-base font-medium shadow-sm transition-shadow hover:shadow"
                  style={
                    branding?.brandColor
                      ? { backgroundColor: branding.brandColor, borderColor: branding.brandColor }
                      : undefined
                  }
                  onClick={handleSignButtonClick}
                  disabled={submitSignatureMutation.isPending || hasUnpaidPayments}
                >
                  {submitSignatureMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <PenLineIcon className="mr-2 h-4 w-4" />
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
                {!(isEmbedded && embedParams.hideDecline) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground w-full"
                    onClick={handleDeclineClick}
                    disabled={declineMutation.isPending}
                  >
                    Decline to sign
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completed state footer */}
          {isCompleted && recipient.status !== "declined" && (
            <div className="border-border/50 bg-muted/20 space-y-4 border-t p-6">
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DownloadIcon className="mr-2 h-4 w-4" />
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
            <div className="dark:bg-background/80 border-border/50 sticky top-0 z-30 border-b bg-white/80 px-4 py-2.5 backdrop-blur-xl lg:top-0">
              <div className="mx-auto flex max-w-4xl items-center justify-between">
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${fieldCompletionPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {fieldCompletionPercent}%
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {filledRequiredFields.length} of {requiredFields.length} fields
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
                      >
                        <ArrowUpIcon className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Prev</span>
                      </Button>
                      <span className="text-muted-foreground min-w-[60px] px-2 text-center text-sm tabular-nums">
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
                    <div className="text-success flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5" />
                      <span className="text-sm font-medium">All fields completed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer Area */}
          <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-secondary dark:bg-muted/30">
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-4xl">
                {/* Page count header */}
                {numPages && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <FileTextIcon className="h-4 w-4" />
                      <span>
                        {numPages} page{numPages > 1 ? "s" : ""}
                      </span>
                    </div>
                    {numPages > 1 && (
                      <span className="text-muted-foreground text-xs">
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
                        <div className="dark:bg-card border-border/50 rounded-lg border bg-white p-16 text-center shadow-sm">
                          <div className="animate-pulse space-y-4">
                            <div className="bg-muted mx-auto h-4 w-1/3 rounded" />
                            <div className="bg-muted mx-auto h-4 w-1/2 rounded" />
                            <div className="bg-muted mx-auto h-4 w-2/5 rounded" />
                          </div>
                        </div>
                      }
                      error={
                        <div className="dark:bg-card border-destructive/30 rounded-lg border bg-white p-16 text-center shadow-sm">
                          <p className="text-destructive font-medium">Failed to load PDF</p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Please try refreshing the page
                          </p>
                        </div>
                      }
                    >
                      {Array.from({ length: numPages ?? 0 }, (_el, index) => {
                        const pageNumber = index + 1;
                        const fieldsOnPage = fields.filter((f) => f.page === pageNumber);

                        return (
                          <div
                            key={`page_${pageNumber}`}
                            className="dark:bg-card border-border/50 relative mb-4 overflow-hidden rounded-lg border bg-white shadow-sm last:mb-0"
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
                            {fieldsOnPage.map((field) => {
                              const pageDims = pdfPageDimensions.get(pageNumber);
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
                                  isFilled={field.isFilled}
                                  isActive={!isCompleted && activeFieldId === field._id}
                                  signatureDetails={field.signatureDetails}
                                  paymentInfo={paymentInfoByFieldId.get(field._id)}
                                  onClick={isCompleted ? () => {} : handleFieldClick}
                                />
                              );
                            })}
                            {/* Page number indicator */}
                            {numPages && numPages > 1 && (
                              <div className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                                {pageNumber} / {numPages}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Document>

                    {/* Signature Stamp - shown when document is completed with no positioned fields */}
                    {isCompleted && fields.length === 0 && recipient.status === "signed" && (
                      <div className="dark:bg-card border-border/50 mx-auto mt-4 max-w-md rounded-lg border bg-white p-4 shadow-sm">
                        <div className="overflow-hidden rounded-md border border-border">
                          {/* Signature details stamp - Name, date and time only */}
                          <div className="bg-card px-4 py-4">
                            <div className="text-success mb-3 flex items-center gap-2">
                              <CheckCircleIcon className="h-6 w-6" />
                              <span className="text-lg font-medium">Document Signed</span>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-muted-foreground text-sm">
                                  Signed by:
                                </span>
                                <span className="text-foreground text-sm font-semibold">
                                  {recipient.name || recipient.email}
                                </span>
                              </div>
                              {recipient.signedAt && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-muted-foreground text-sm">
                                    Date:
                                  </span>
                                  <span className="text-foreground text-sm">
                                    {new Date(recipient.signedAt).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}{" "}
                                    at{" "}
                                    {new Date(recipient.signedAt).toLocaleTimeString("en-US", {
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
                  <div className="dark:bg-card border-border/50 rounded-lg border bg-white p-16 text-center shadow-sm">
                    <div className="animate-pulse space-y-4">
                      <div className="bg-muted mx-auto h-4 w-1/3 rounded" />
                      <div className="bg-muted mx-auto h-4 w-1/2 rounded" />
                      <div className="bg-muted mx-auto h-4 w-2/5 rounded" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Action Bar - Fixed at bottom on mobile */}
          {!isCompleted && !showSignatureCapture && (
            <div
              className={`dark:bg-background/95 border-border/50 sticky bottom-0 z-40 border-t bg-white/95 p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden ${isEmbedded ? "!block" : ""}`}
            >
              <div className="flex gap-3">
                {!(isEmbedded && embedParams.hideDecline) && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 flex-1"
                    onClick={handleDeclineClick}
                    disabled={declineMutation.isPending}
                  >
                    Decline
                  </Button>
                )}
                <Button
                  size="lg"
                  className="h-12 flex-1 font-medium"
                  onClick={handleSignButtonClick}
                  disabled={submitSignatureMutation.isPending}
                >
                  {submitSignatureMutation.isPending ? (
                    "Submitting..."
                  ) : mainSignatureField && isMainSignatureFilled ? (
                    "Submit"
                  ) : recipient.role === "signer" ? (
                    <>
                      <PenLineIcon className="mr-2 h-4 w-4" />
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
            <div className="dark:bg-background/95 border-border/50 sticky bottom-0 z-40 border-t bg-white/95 p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
              {recipient.status !== "declined" ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <DownloadIcon className="mr-2 h-4 w-4" />
                  )}
                  {isDownloading ? "Preparing..." : "Download Document"}
                </Button>
              ) : (
                <p className="text-muted-foreground text-center text-sm">
                  You have declined this document.
                </p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Signature Capture Modal */}
      <Dialog
        open={!isCompleted && showSignatureCapture}
        onOpenChange={(open) => !open && handleCancelSignature()}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Sign Document</DialogTitle>
          <SignatureCapture
            recipientName={recipient.name}
            onSignatureCapture={handleSignatureCapture}
            onCancel={handleCancelSignature}
            allowedSignatureTypes={signingSettings?.allowedSignatureTypes}
          />
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining. This will be shared with the document sender.
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
      {activeFieldId && (
        <FieldInputManager
          open={showFieldInput}
          onOpenChange={setShowFieldInput}
          fieldId={activeFieldId}
          fieldType={fields.find((f) => f._id === activeFieldId)?.fieldType || "text"}
          label={capitalizeFieldLabel(fields.find((f) => f._id === activeFieldId)?.label || "")}
          isRequired={fields.find((f) => f._id === activeFieldId)?.isRequired || false}
          currentValue={fields.find((f) => f._id === activeFieldId)?.currentValue}
          currentSignatureImageUrl={
            fields.find((f) => f._id === activeFieldId)?.currentSignatureImageUrl
          }
          properties={fields.find((f) => f._id === activeFieldId)?.properties}
          onSave={handleFieldSave}
          recipientName={recipient.name}
          signingToken={token}
        />
      )}

      {/* Branding footer (hidden in embedded mode) */}
      {!isEmbedded && !branding?.hideSealBranding && (
        <div className="border-border/50 text-muted-foreground hidden shrink-0 border-t py-2 text-center text-xs lg:block">
          {branding?.customFooterText || (
            <a href="https://seal.nyc" className="hover:text-foreground transition-colors">
              Powered by Seal
            </a>
          )}
        </div>
      )}
      {!isEmbedded && branding?.hideSealBranding && branding?.customFooterText && (
        <div className="border-border/50 text-muted-foreground hidden shrink-0 border-t py-2 text-center text-xs lg:block">
          {branding.customFooterText}
        </div>
      )}
    </div>
  );
}
