import { useMutation } from "convex/react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  FileSignatureIcon,
  PenLineIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { DeclineDialog } from "./decline-dialog";
import { FieldInputManager } from "./field-input-manager";
import { SignatureCapture } from "./signature-capture";

interface FieldWithValue {
  _id: Id<"signature_fields">;
  documentId: Id<"documents">;
  recipientId: Id<"document_recipients">;
  fieldType: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  isRequired: boolean;
  isMainSignature?: boolean;
  currentValue?: string;
  currentSignatureImageUrl?: string;
  isFilled: boolean;
  signatureDetails?: {
    signedAt: number;
    signerName?: string;
    signerEmail?: string;
    signatureMethod?: string;
  };
  properties?: {
    placeholder?: string;
    defaultValue?: string;
    options?: string[];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    helpText?: string;
  };
  validationRules?: {
    min?: number;
    max?: number;
  };
}

interface RecipientData {
  _id: Id<"document_recipients">;
  documentId: Id<"documents">;
  email: string;
  name?: string;
  role: "signer" | "viewer" | "approver";
  status: "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";
  documentWorkflowStatus?: string;
  signatureData?: string;
  signatureType?: string;
}

interface InAppSigningSectionProps {
  documentId: Id<"documents">;
  recipient: RecipientData;
  fields: FieldWithValue[];
  isOpen: boolean;
  onOpenChange: () => void;
  onFieldsRefetch: () => void;
}

export function InAppSigningSection({
  documentId,
  recipient,
  fields,
  isOpen,
  onOpenChange,
  onFieldsRefetch,
}: InAppSigningSectionProps) {
  const [activeFieldId, setActiveFieldId] = useState<Id<"signature_fields"> | null>(null);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveFieldValue = useMutation(api.signatures.mutations.saveFieldValueAuthenticated);
  const submitSignature = useMutation(
    api.documents.recipients_mutations.submitSignatureAuthenticated,
  );

  // Calculate progress
  const requiredFields = fields.filter((f) => f.isRequired);
  const filledRequiredFields = requiredFields.filter((f) => f.isFilled);
  const progress =
    requiredFields.length > 0
      ? Math.round((filledRequiredFields.length / requiredFields.length) * 100)
      : 100;
  const allRequiredFilled = filledRequiredFields.length === requiredFields.length;

  // Get main signature field for final submission
  const mainSignatureField = fields.find((f) => f.isMainSignature && f.fieldType === "signature");

  // Check if signing is allowed
  const canSign = recipient.status === "pending" || recipient.status === "viewed";
  const isCompleted = recipient.status === "signed" || recipient.status === "approved";
  const isDeclined = recipient.status === "declined";

  const handleFieldClick = (fieldId: Id<"signature_fields">) => {
    if (!canSign) return;
    setActiveFieldId(fieldId);
  };

  const handleFieldSave = async (value?: string, signatureImageUrl?: string) => {
    if (!activeFieldId) return;

    try {
      // Determine signature method from the data
      let signatureMethod: "draw" | "type" | "upload" | undefined;
      if (signatureImageUrl) {
        // If it's a data URL, it could be drawn or uploaded
        // Typed signatures are usually text values, not image URLs
        signatureMethod = "draw";
      }

      await saveFieldValue({
        documentId,
        fieldId: activeFieldId,
        value,
        signatureImageUrl,
        signatureMethod,
        userAgent: navigator.userAgent,
      });
      toast.success("Field saved");
      onFieldsRefetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save field");
    } finally {
      setActiveFieldId(null);
    }
  };

  const handleSignDocument = async (
    signatureData: string,
    signatureType: "drawn" | "typed" | "uploaded",
  ) => {
    setIsSubmitting(true);
    try {
      // If there's a main signature field, save it first
      if (mainSignatureField && !mainSignatureField.isFilled) {
        await saveFieldValue({
          documentId,
          fieldId: mainSignatureField._id,
          signatureImageUrl: signatureData,
          signatureMethod:
            signatureType === "drawn" ? "draw" : signatureType === "typed" ? "type" : "upload",
          userAgent: navigator.userAgent,
        });
      }

      // Submit the signature
      await submitSignature({
        documentId,
        status: recipient.role === "approver" ? "approved" : "signed",
        signatureData,
        signatureType,
      });

      toast.success(
        recipient.role === "approver"
          ? "Document approved successfully"
          : "Document signed successfully",
      );
      setShowSignatureCapture(false);
      onFieldsRefetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (reason: string) => {
    setIsSubmitting(true);
    try {
      await submitSignature({
        documentId,
        status: "declined",
        declineReason: reason,
      });
      toast.success("Document declined");
      setShowDeclineDialog(false);
      onFieldsRefetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to decline document");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the active field for the input manager
  const activeField = activeFieldId ? fields.find((f) => f._id === activeFieldId) : null;

  // Status colors
  const getStatusConfig = () => {
    if (isCompleted) {
      return {
        bgColor: "bg-success-surface",
        textColor: "text-success",
        icon: CheckCircleIcon,
        label: recipient.status === "approved" ? "Approved" : "Signed",
      };
    }
    if (isDeclined) {
      return {
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
        icon: XCircleIcon,
        label: "Declined",
      };
    }
    return {
      bgColor: "bg-warning-surface",
      textColor: "text-warning",
      icon: ClockIcon,
      label: "Pending",
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Collapsible
        open={isOpen}
        onOpenChange={onOpenChange}
        className="border-warning/30 bg-warning-surface/50 overflow-hidden rounded-2xl border-2 shadow-sm sm:rounded-xl"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-warning-surface/80 flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${statusConfig.bgColor} ${statusConfig.textColor} sm:h-8 sm:w-8 sm:rounded-lg`}
              >
                <PenLineIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              </div>
              <div className="text-left">
                <span className="text-foreground block font-sans text-[0.9375rem] font-semibold sm:text-sm">
                  Your Signature
                </span>
                <span
                  className={`font-sans text-xs ${statusConfig.textColor} flex items-center gap-1`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </span>
              </div>
            </div>
            <ChevronDownIcon
              className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-warning/20 px-5 pb-5 sm:px-4 sm:pb-4 border-t">
          {/* Progress bar */}
          {canSign && fields.length > 0 && (
            <div className="mt-4 mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs font-medium">
                  Progress
                </span>
                <span className="text-muted-foreground font-sans text-xs">
                  {filledRequiredFields.length} of {requiredFields.length} required fields
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-warning h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Fields list */}
          {canSign && fields.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-muted-foreground mb-2 font-sans text-xs font-medium">
                Fields to complete
              </div>
              {fields.map((field) => (
                <button
                  key={field._id}
                  type="button"
                  onClick={() => handleFieldClick(field._id)}
                  disabled={!canSign}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    field.isFilled
                      ? "border-success/30 bg-success-surface cursor-default"
                      : "border-border bg-card hover:border-warning/50 hover:bg-warning-surface cursor-pointer"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      field.isFilled
                        ? "bg-success-surface text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {field.isFilled ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <FileSignatureIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate font-sans text-sm">
                      {field.label || getFieldTypeLabel(field.fieldType)}
                    </div>
                    <div className="text-muted-foreground font-sans text-xs">
                      Page {field.page}
                      {field.isRequired && !field.isFilled && (
                        <span className="text-warning ml-1">• Required</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="mt-4 py-4 text-center">
              <div className="bg-success-surface text-success mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <div className="text-foreground font-sans text-sm font-semibold">
                {recipient.status === "approved"
                  ? "You have approved this document"
                  : "You have signed this document"}
              </div>
            </div>
          )}

          {/* Declined state */}
          {isDeclined && (
            <div className="mt-4 py-4 text-center">
              <div className="bg-destructive/10 text-destructive mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                <XCircleIcon className="h-6 w-6" />
              </div>
              <div className="text-foreground font-sans text-sm font-semibold">
                You have declined this document
              </div>
            </div>
          )}

          {/* Action buttons */}
          {canSign && (
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => setShowSignatureCapture(true)}
                disabled={!allRequiredFilled || isSubmitting}
                className="w-full"
              >
                <PenLineIcon className="mr-2 h-4 w-4" />
                {recipient.role === "approver" ? "Approve Document" : "Sign Document"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeclineDialog(true)}
                disabled={isSubmitting}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
              >
                <XCircleIcon className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Field Input Dialog */}
      {activeField && (
        <FieldInputManager
          open={!!activeFieldId}
          onOpenChange={(open) => {
            if (!open) setActiveFieldId(null);
          }}
          fieldId={activeField._id}
          fieldType={activeField.fieldType}
          label={activeField.label || getFieldTypeLabel(activeField.fieldType)}
          isRequired={activeField.isRequired}
          currentValue={activeField.currentValue}
          currentSignatureImageUrl={activeField.currentSignatureImageUrl}
          properties={activeField.properties}
          validationRules={activeField.validationRules}
          recipientName={recipient.name || recipient.email}
          onSave={handleFieldSave}
        />
      )}

      {/* Signature Capture Dialog */}
      {showSignatureCapture && (
        <SignatureCapture
          recipientName={recipient.name || recipient.email}
          onSignatureCapture={handleSignDocument}
          onCancel={() => setShowSignatureCapture(false)}
          showLibrary={true}
        />
      )}

      {/* Decline Dialog */}
      <DeclineDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        onDecline={handleDecline}
        isSubmitting={isSubmitting}
      />
    </>
  );
}

function getFieldTypeLabel(fieldType: string): string {
  const labels: Record<string, string> = {
    signature: "Signature",
    text: "Text",
    number: "Number",
    date: "Date",
    checkbox: "Checkbox",
    dropdown: "Dropdown",
    radio: "Radio",
    attachment: "Attachment",
  };
  return labels[fieldType] || fieldType;
}
