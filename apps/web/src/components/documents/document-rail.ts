/**
 * Document rail decisions.
 *
 * The document page keeps one right-hand rail. These functions are the
 * rules for which panel is showing, whether the user can leave it, and
 * what Send / Fields / a page click should do. The page calls them; the
 * tests in document-rail.test.ts are the catalog of edge cases.
 */

export const FINISH_FIELD_MESSAGE = "Finish this field, or use Back.";

export type OptionsFieldType =
  | "checkbox"
  | "dropdown"
  | "radio"
  | "multi_select";

export type RailPanelId =
  | "remove-recipient"
  | "recipient-options"
  | "delete-field"
  | "field-options"
  | "payment"
  | "field-properties"
  | "send"
  | "save-template"
  | "add-myself"
  | "add-recipient";

export type SendIntent =
  | { readonly kind: "finish-field" }
  | { readonly kind: "open-send" }
  | { readonly kind: "open-add-recipient" }
  | { readonly kind: "blocked"; readonly message: string; readonly openFields: boolean };

export type PlaceFieldsIntent = "add-recipient" | "open-fields" | "stay";

export type PagePlaceIntent = "finish-field" | "add-recipient" | "place";

export type PlacementChooser = "hidden" | "named" | "select";

type Person = {
  readonly _id: string;
  readonly role: string;
  readonly name?: string | null;
  readonly email: string;
};

type AssignedField = {
  readonly recipientId?: string | null;
  readonly fieldType?: string | null;
};

export function isSigningFieldType(
  fieldType: string | null | undefined
): boolean {
  return (
    fieldType === "signature" ||
    fieldType === "free_signature" ||
    fieldType === "initials"
  );
}

export function countSigningFields(
  fields: readonly { readonly fieldType?: string | null }[]
): number {
  return fields.filter((field) => isSigningFieldType(field.fieldType)).length;
}

export function asOptionsFieldType(
  fieldType: string | null | undefined
): OptionsFieldType | null {
  if (
    fieldType === "checkbox" ||
    fieldType === "dropdown" ||
    fieldType === "radio" ||
    fieldType === "multi_select"
  ) {
    return fieldType;
  }
  return null;
}

export function fieldTypeNeedsOptions(fieldType: string): boolean {
  return asOptionsFieldType(fieldType) !== null;
}

export function fieldOptionsPanelReady(
  showFieldOptions: boolean,
  fieldType: string | null | undefined
): boolean {
  return showFieldOptions && asOptionsFieldType(fieldType) !== null;
}

export function isFieldSetupOpen(input: {
  readonly showFieldOptions: boolean;
  readonly provisionalPaymentFieldPublicId: string | null;
}): boolean {
  return input.showFieldOptions || input.provisionalPaymentFieldPublicId !== null;
}

export function canLeaveFieldSetup(fieldSetupOpen: boolean): boolean {
  return !fieldSetupOpen;
}

export function signerRecipients<T extends { readonly role: string }>(
  recipients: readonly T[]
): T[] {
  return recipients.filter((recipient) => recipient.role === "signer");
}

export function signerForPlacement<T extends { readonly _id: string }>(
  signers: readonly T[],
  selectedId: string | null | undefined
): T | null {
  if (signers.length === 0) return null;
  return signers.find((signer) => signer._id === selectedId) ?? signers[0] ?? null;
}

export function nextPlacementSignerId<
  T extends { readonly _id: string; readonly role: string },
>(recipients: readonly T[], selectedId: string | null): T["_id"] | null {
  const signers = signerRecipients(recipients);
  if (signers.length === 0) return null;
  if (
    selectedId !== null &&
    signers.some((signer) => signer._id === selectedId)
  ) {
    return selectedId;
  }
  const first = signers[0];
  return first ? first._id : null;
}

export function placementFieldChooser(signerCount: number): PlacementChooser {
  if (signerCount <= 0) return "hidden";
  if (signerCount === 1) return "named";
  return "select";
}

export function allowFieldDelete(input: {
  readonly showFieldOptions: boolean;
  readonly showPaymentConfigModal: boolean;
  readonly showFieldProperties: boolean;
  readonly provisionalPaymentFieldPublicId: string | null;
}): boolean {
  return (
    !input.showFieldOptions &&
    !input.showPaymentConfigModal &&
    !input.showFieldProperties &&
    input.provisionalPaymentFieldPublicId === null
  );
}

export function provisionalPaymentToDelete(input: {
  readonly provisionalFieldPublicId: string | null;
  readonly committed: boolean;
}): string | null {
  if (!input.provisionalFieldPublicId || input.committed) return null;
  return input.provisionalFieldPublicId;
}

export function finishPaymentSave(notify: {
  readonly onSaved?: () => void;
  readonly onOpenChange: (open: boolean) => void;
}): void {
  notify.onSaved?.();
  notify.onOpenChange(false);
}

export function activeRailPanel(input: {
  readonly removeRecipient: boolean;
  readonly recipientOptions: boolean;
  readonly deleteField: boolean;
  readonly fieldOptions: boolean;
  readonly payment: boolean;
  readonly fieldProperties: boolean;
  readonly send: boolean;
  readonly saveTemplate: boolean;
  readonly addMyself: boolean;
  readonly addRecipient: boolean;
}): RailPanelId | null {
  if (input.removeRecipient) return "remove-recipient";
  if (input.recipientOptions) return "recipient-options";
  if (input.deleteField) return "delete-field";
  if (input.fieldOptions) return "field-options";
  if (input.payment) return "payment";
  if (input.fieldProperties) return "field-properties";
  if (input.send) return "send";
  if (input.saveTemplate) return "save-template";
  if (input.addMyself) return "add-myself";
  if (input.addRecipient) return "add-recipient";
  return null;
}

export function railStepFor(panel: RailPanelId | null): 1 | 2 | 3 | undefined {
  if (
    panel === "remove-recipient" ||
    panel === "recipient-options" ||
    panel === "add-myself" ||
    panel === "add-recipient"
  ) {
    return 1;
  }
  if (
    panel === "delete-field" ||
    panel === "field-options" ||
    panel === "payment" ||
    panel === "field-properties"
  ) {
    return 2;
  }
  if (panel === "send") return 3;
  return undefined;
}

export function resolveSendIntent(input: {
  readonly fieldSetupOpen: boolean;
  readonly canSend: boolean;
  readonly canEdit: boolean;
  readonly signerCount: number;
  readonly blockedReason?: string;
}): SendIntent {
  if (input.fieldSetupOpen) return { kind: "finish-field" };
  if (input.canSend) return { kind: "open-send" };
  if (input.canEdit && input.signerCount === 0) {
    return { kind: "open-add-recipient" };
  }
  return {
    kind: "blocked",
    message: input.blockedReason ?? "Only a draft can be sent.",
    openFields: input.canEdit,
  };
}

export function resolvePlaceFieldsIntent(input: {
  readonly canEdit: boolean;
  readonly signerCount: number;
}): PlaceFieldsIntent {
  if (input.signerCount === 0) {
    return input.canEdit ? "add-recipient" : "stay";
  }
  return "open-fields";
}

export function resolvePagePlaceIntent(input: {
  readonly fieldSetupOpen: boolean;
  readonly signerCount: number;
}): PagePlaceIntent {
  if (input.fieldSetupOpen) return "finish-field";
  if (input.signerCount === 0) return "add-recipient";
  return "place";
}

export function sendDocumentReadiness(input: {
  readonly workflowStatus: string | null | undefined;
  readonly documentStatus: string;
  readonly recipients: readonly Person[];
  readonly fields: readonly AssignedField[];
}): { readonly canSend: boolean; readonly tooltip?: string } {
  const isPrep =
    !input.workflowStatus ||
    input.workflowStatus === "draft" ||
    input.workflowStatus === "uploaded";
  const isExpired = input.workflowStatus === "expired";
  const canEdit = input.documentStatus === "active" && isPrep;
  const canSendStatus = isPrep || isExpired;
  if (!canSendStatus || (!canEdit && !isExpired)) {
    return { canSend: false, tooltip: "Only a draft can be sent." };
  }
  if (input.recipients.length === 0) {
    return { canSend: false, tooltip: "Add a recipient before sending." };
  }

  const unassignedFields = input.fields.filter((field) => !field.recipientId);
  if (unassignedFields.length > 0) {
    const count = unassignedFields.length;
    return {
      canSend: false,
      tooltip:
        count === 1
          ? "1 field is not assigned to a recipient. Assign it before sending."
          : `${count} fields are not assigned to a recipient. Assign them before sending.`,
    };
  }

  const signersWithoutSigningField = signerRecipients(input.recipients).filter(
    (signer) =>
      !input.fields.some(
        (field) =>
          field.recipientId === signer._id &&
          isSigningFieldType(field.fieldType)
      )
  );
  if (signersWithoutSigningField.length > 0) {
    const signerNames = signersWithoutSigningField
      .map((signer) => signer.name || signer.email)
      .join(", ");
    const noun =
      signersWithoutSigningField.length === 1 ? "needs" : "need";
    return {
      canSend: false,
      tooltip: `${signerNames} ${noun} a signature or initials field before this can be sent.`,
    };
  }

  return { canSend: true };
}
