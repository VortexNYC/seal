import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FIELD_DIMENSIONS, type PlacedField } from "../draggable-field";
import { type FieldOptionsConfig } from "../field-options-dialog";
import type { FieldType } from "../field-toolbar";

type Recipient = {
  _id: Id<"document_recipients">;
  role: "signer" | "viewer" | "approver";
};

type SignatureField = {
  _id: Id<"signature_fields">;
  fieldType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  recipientId?: Id<"document_recipients"> | null;
  label: string;
  properties?: { options?: string[] } | null;
};

type SignatureData = {
  signatureImageUrl?: string | null | undefined;
  value?: string | null | undefined;
  signedAt?: number;
  signatureMethod?: string;
  signerName?: string;
  primarySignerEmail?: string;
};

type PaymentConfig = {
  totalAmountCents: number;
  currency: string;
  paymentType: string;
  paymentStatus?: string;
};

interface UseFieldPlacementOptions {
  documentId: Id<"documents">;
  recipients: Recipient[];
  signatureFields: SignatureField[];
  currentPage: number;
  pdfWidth: number;
  pdfHeight: number;
  refetchFields: () => Promise<unknown>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  signaturesByFieldId: Map<string, SignatureData>;
  paymentConfigByFieldId: Map<string, PaymentConfig>;
}

/**
 * Manages all field placement state and handlers: dragging fields from the toolbar,
 * dropping them onto the PDF canvas, assigning recipients, configuring options,
 * selecting/deleting/repositioning fields, and keyboard shortcuts.
 */
export function useFieldPlacement({
  documentId,
  recipients,
  signatureFields,
  currentPage,
  pdfWidth,
  pdfHeight,
  refetchFields,
  containerRef,
  signaturesByFieldId,
  paymentConfigByFieldId,
}: UseFieldPlacementOptions) {
  const [draggingFieldType, setDraggingFieldType] = useState<FieldType | null>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showFieldDeleteDialog, setShowFieldDeleteDialog] = useState(false);

  // Recipient selector for field assignment after drop
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<Id<"document_recipients"> | null>(
    null,
  );
  const [pendingFieldData, setPendingFieldData] = useState<{
    fieldType: FieldType;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  } | null>(null);

  // Field options dialog for checkbox/dropdown/radio configuration
  const [showFieldOptions, setShowFieldOptions] = useState(false);
  const [pendingFieldOptions, setPendingFieldOptions] = useState<FieldOptionsConfig | null>(null);
  const [pendingFieldName, setPendingFieldName] = useState<string | null>(null);

  // Field properties dialog
  const [showFieldProperties, setShowFieldProperties] = useState(false);
  const [fieldPropertiesId, setFieldPropertiesId] = useState<string | null>(null);

  // Payment config modal
  const [showPaymentConfigModal, setShowPaymentConfigModal] = useState(false);
  const [paymentConfigFieldId, setPaymentConfigFieldId] = useState<Id<"signature_fields"> | null>(
    null,
  );

  const createField = useMutation(api.signature_fields.mutations.createField);
  const repositionField = useMutation(api.signature_fields.mutations.repositionField);
  const deleteField = useMutation(api.signature_fields.mutations.deleteField);

  // SEA-91: Sync database fields to local state, including signature and payment data
  useEffect(() => {
    const fields: PlacedField[] = signatureFields.map((field) => ({
      id: field._id,
      fieldType: field.fieldType as FieldType,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      pageNumber: field.page,
      recipientId: field.recipientId ?? undefined,
      label: field.label,
      properties: field.properties ?? undefined,
      paymentTotalCents: paymentConfigByFieldId.get(field._id)?.totalAmountCents,
      signatureData: (() => {
        const sd = signaturesByFieldId.get(field._id);
        if (!sd) return undefined;
        return {
          ...sd,
          signatureImageUrl: sd.signatureImageUrl ?? undefined,
          value: sd.value ?? undefined,
        };
      })(),
    }));
    setPlacedFields(fields);
  }, [signatureFields, signaturesByFieldId, paymentConfigByFieldId]);

  // Auto-hide delete dialog when field is deselected
  useEffect(() => {
    if (!selectedFieldId) {
      setShowFieldDeleteDialog(false);
    }
  }, [selectedFieldId]);

  // Keyboard shortcut: Delete/Backspace to delete selected field
  const requestFieldDelete = useCallback(() => {
    if (selectedFieldId) {
      setShowFieldDeleteDialog(true);
    }
  }, [selectedFieldId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        selectedFieldId &&
        (e.key === "Delete" || e.key === "Backspace") &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        if (
          window.document.activeElement?.tagName !== "INPUT" &&
          window.document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          requestFieldDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFieldId, requestFieldDelete]);

  const formatFieldTypeLabel = (fieldType: FieldType): string => {
    const typeLabels: Record<FieldType, string> = {
      signature: "Signature",
      text: "Text",
      number: "Number",
      date: "Date",
      checkbox: "Checkbox",
      dropdown: "Dropdown",
      radio: "Radio",
      attachment: "Attachment",
      payment: "Payment",
    };
    return `${typeLabels[fieldType]} Field`;
  };

  const fieldTypeRequiresOptions = (fieldType: FieldType): boolean => {
    return fieldType === "checkbox" || fieldType === "dropdown" || fieldType === "radio";
  };

  const handleFieldDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleFieldDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData("fieldType") as FieldType;
    if (!fieldType) return;

    const signers = recipients.filter((r) => r.role === "signer");
    if (signers.length === 0) {
      toast.error(
        "Please add at least one signer before placing fields. Approvers and viewers cannot have fields assigned.",
      );
      setDraggingFieldType(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const targetPageNumber = currentPage;
    const targetPageElement = container.querySelector(".react-pdf__Page");
    if (!targetPageElement) {
      toast.error("Could not determine drop location");
      setDraggingFieldType(null);
      return;
    }

    const pageRect = targetPageElement.getBoundingClientRect();
    const { width: widthPixels, height: heightPixels } = FIELD_DIMENSIONS[fieldType];

    const currentScale = pageRect.width / pdfWidth;
    const scaledFieldWidth = widthPixels * currentScale;
    const scaledFieldHeight = heightPixels * currentScale;

    const dropXPixels = e.clientX - pageRect.left - scaledFieldWidth / 2;
    const dropYPixels = e.clientY - pageRect.top - scaledFieldHeight / 2;

    const unscaledDropX = dropXPixels / currentScale;
    const unscaledDropY = dropYPixels / currentScale;

    const xPercent = (unscaledDropX / pdfWidth) * 100;
    const yPercent = (unscaledDropY / pdfHeight) * 100;
    const widthPercent = (widthPixels / pdfWidth) * 100;
    const heightPercent = (heightPixels / pdfHeight) * 100;

    setPendingFieldData({
      fieldType,
      x: xPercent,
      y: yPercent,
      width: widthPercent,
      height: heightPercent,
      page: targetPageNumber,
    });

    if (signers.length > 0) {
      setSelectedRecipientId(signers[0]._id);
    }

    setShowRecipientSelector(true);
    setDraggingFieldType(null);
  };

  const createFieldWithOptions = async (
    optionsConfig: FieldOptionsConfig | null,
    fieldName?: string | null,
  ) => {
    if (!pendingFieldData || !selectedRecipientId) return;

    try {
      let finalWidth = pendingFieldData.width;
      let finalHeight = pendingFieldData.height;

      if (optionsConfig && optionsConfig.options.length > 0) {
        const optionCount = optionsConfig.options.length;
        const rowHeight = 22;
        const padding = 16;
        const titleHeight = 16;
        const minWidth = 140;

        const heightPixels = titleHeight + padding + optionCount * rowHeight;
        const widthPixels = Math.max(minWidth, 150);

        finalWidth = (widthPixels / pdfWidth) * 100;
        finalHeight = (heightPixels / pdfHeight) * 100;
      }

      const label = fieldName || formatFieldTypeLabel(pendingFieldData.fieldType);

      const fieldId = await createField({
        documentId,
        recipientId: selectedRecipientId as Id<"document_recipients">,
        fieldType: pendingFieldData.fieldType,
        label,
        isRequired: true,
        x: pendingFieldData.x,
        y: pendingFieldData.y,
        width: finalWidth,
        height: finalHeight,
        page: pendingFieldData.page,
        ...(optionsConfig &&
          optionsConfig.options.length > 0 && {
            properties: {
              options: optionsConfig.options.map((opt) => opt.label),
            },
          }),
      });

      setSelectedFieldId(fieldId);
      setDraggingFieldType(null);

      if (pendingFieldData.fieldType === "payment") {
        setPaymentConfigFieldId(fieldId);
        setShowPaymentConfigModal(true);
      }

      await refetchFields();
      toast.success(`${label} assigned to recipient`);

      setShowRecipientSelector(false);
      setPendingFieldData(null);
      setSelectedRecipientId(null);
      setPendingFieldOptions(null);
      setPendingFieldName(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create field";
      toast.error(errorMessage);
      setDraggingFieldType(null);
    }
  };

  const handleConfirmFieldPlacement = async (fieldName: string) => {
    if (!pendingFieldData || !selectedRecipientId) return;

    setPendingFieldName(fieldName);

    if (fieldTypeRequiresOptions(pendingFieldData.fieldType)) {
      setShowRecipientSelector(false);
      setShowFieldOptions(true);
      return;
    }

    await createFieldWithOptions(null, fieldName);
  };

  const handleFieldOptionsConfirm = async (config: FieldOptionsConfig) => {
    setPendingFieldOptions(config);
    setShowFieldOptions(false);
    await createFieldWithOptions(config, pendingFieldName);
  };

  const handleFieldOptionsCancel = () => {
    setShowFieldOptions(false);
    setPendingFieldData(null);
    setSelectedRecipientId(null);
    setPendingFieldOptions(null);
    setPendingFieldName(null);
    setDraggingFieldType(null);
  };

  const handleFieldUpdate = async (
    fieldId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    setPlacedFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, x, y, width, height } : field)),
    );

    try {
      await repositionField({
        fieldId: fieldId as Id<"signature_fields">,
        x,
        y,
        width,
        height,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update field";
      toast.error(errorMessage);
      await refetchFields();
    }
  };

  const handleFieldSelect = (fieldId: string | null) => {
    setSelectedFieldId(fieldId);
  };

  const handleFieldDelete = useCallback(async () => {
    if (!selectedFieldId) return;

    try {
      await deleteField({ fieldId: selectedFieldId as Id<"signature_fields"> });
      setSelectedFieldId(null);
      await refetchFields();
      toast.success("Field deleted");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete field";
      toast.error(errorMessage);
    }
  }, [selectedFieldId, deleteField, refetchFields]);

  const handleFieldDeleteConfirm = useCallback(async () => {
    await handleFieldDelete();
    setShowFieldDeleteDialog(false);
  }, [handleFieldDelete]);

  return {
    // State
    draggingFieldType,
    setDraggingFieldType,
    placedFields,
    selectedFieldId,
    showFieldDeleteDialog,
    setShowFieldDeleteDialog,
    showRecipientSelector,
    setShowRecipientSelector,
    selectedRecipientId,
    setSelectedRecipientId,
    pendingFieldData,
    showFieldOptions,
    pendingFieldOptions,
    showFieldProperties,
    setShowFieldProperties,
    fieldPropertiesId,
    setFieldPropertiesId,
    showPaymentConfigModal,
    setShowPaymentConfigModal,
    paymentConfigFieldId,
    setPaymentConfigFieldId,
    // Handlers
    handleFieldDragOver,
    handleFieldDrop,
    handleFieldUpdate,
    handleFieldSelect,
    requestFieldDelete,
    handleFieldDeleteConfirm,
    handleConfirmFieldPlacement,
    handleFieldOptionsConfirm,
    handleFieldOptionsCancel,
  };
}
