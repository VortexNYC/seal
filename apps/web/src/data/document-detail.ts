import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  FIELD_TYPES,
  type FieldType,
} from "@/components/documents/field-toolbar";
import {
  getDocument,
  getDocumentRecipients,
  getRecipientProgress,
  getDocumentSignatureFields,
  getDocumentSignatures,
  getDocumentPaymentConfigs,
  getCurrentUserRecipient,
  getCurrentUserSignatureFields,
  type ApiRecipient,
  type ApiSignatureField,
  type ApiSignatureFieldWithValues,
  type ApiSignature,
  type ApiPaymentConfig,
} from "@/lib/api-client";
import { type Id, parseId } from "@/lib/ids";
import { parseSelectValue } from "@/lib/select-values";

export type DocumentDetailRecipient = {
  _id: Id<"document_recipients">;
  publicId: string;
  documentId: Id<"documents">;
  name?: string;
  email: string;
  role: "signer" | "viewer" | "approver";
  order: number;
  status: "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";
  signingToken?: string;
  tokenExpiresAt: number | null | undefined;
  viewedAt: number | null | undefined;
  signedAt: number | null | undefined;
  approvedAt: number | null | undefined;
  declinedAt: number | null | undefined;
  createdAt: number;
  updatedAt: number;
};

export type DocumentDetailSignatureField = {
  _id: Id<"signature_fields">;
  _creationTime: number;
  publicId: string;
  documentId: Id<"documents">;
  fieldType: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  label: string;
  isRequired: boolean;
  recipientId?: Id<"document_recipients">;
  properties?: FieldProperties;
  createdAt: number;
  updatedAt: number;
};

export type DocumentDetailSignature = {
  fieldId?: Id<"signature_fields">;
  recipientId: Id<"document_recipients">;
  value?: string;
  signatureImageUrl?: string;
  signedAt: number;
  signatureMethod?: string;
};

export type DocumentDetailPaymentConfig = {
  fieldId: Id<"signature_fields">;
  totalAmountCents: number;
  currency: string;
  paymentType: string;
  paymentStatus?: string;
};

export type FieldProperties = {
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  helpText?: string;
};

export type DocumentDetailProgress = {
  percentComplete: number;
  byStatus: {
    signed: number;
    pending: number;
    viewed: number;
    declined: number;
  };
};

const RECIPIENT_STATUSES = [
  "pending",
  "viewed",
  "signed",
  "approved",
  "declined",
  "expired",
] as const;

function toRecipient(r: ApiRecipient): DocumentDetailRecipient {
  return {
    _id: parseId("document_recipients", r.id),
    publicId: r.publicId,
    documentId: parseId("documents", r.documentId),
    name: r.name ?? undefined,
    email: r.email,
    role:
      parseSelectValue(r.role, ["signer", "viewer", "approver"] as const) ??
      "signer",
    status:
      parseSelectValue(r.status, RECIPIENT_STATUSES) ?? ("pending" as const),
    order: r.order,
    signingToken: r.signingToken ?? undefined,
    tokenExpiresAt: r.tokenExpiresAt,
    viewedAt: r.viewedAt,
    signedAt: r.signedAt,
    approvedAt: r.approvedAt,
    declinedAt: r.declinedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toFieldType(value: string): FieldType {
  return parseSelectValue(value, FIELD_TYPES) ?? ("text" as const);
}

function toFieldProperties(
  props: Record<string, unknown> | null
): FieldProperties | undefined {
  if (!props) return undefined;
  const options =
    "options" in props && Array.isArray(props.options)
      ? props.options.filter((o): o is string => typeof o === "string")
      : undefined;
  const pickString = (key: keyof FieldProperties) =>
    key in props && typeof props[key] === "string" ? props[key] : undefined;
  const pickNumber = (key: keyof FieldProperties) =>
    key in props && typeof props[key] === "number" ? props[key] : undefined;
  return {
    placeholder: pickString("placeholder"),
    defaultValue: pickString("defaultValue"),
    options,
    maxLength: pickNumber("maxLength"),
    minLength: pickNumber("minLength"),
    pattern: pickString("pattern"),
    helpText: pickString("helpText"),
  };
}

function toSignatureField(f: ApiSignatureField): DocumentDetailSignatureField {
  return {
    _id: parseId("signature_fields", f.id),
    _creationTime: f.createdAt,
    publicId: f.publicId,
    documentId: parseId("documents", f.documentId),
    fieldType: toFieldType(f.fieldType),
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    page: f.page,
    label: f.label,
    isRequired: f.isRequired,
    recipientId: f.recipientId
      ? parseId("document_recipients", f.recipientId)
      : undefined,
    properties: toFieldProperties(f.properties),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function toSignature(s: ApiSignature): DocumentDetailSignature {
  return {
    fieldId: s.fieldId ? parseId("signature_fields", s.fieldId) : undefined,
    recipientId: parseId("document_recipients", s.recipientId),
    value: s.value ?? undefined,
    signatureImageUrl: s.signatureImageUrl ?? undefined,
    signedAt: s.signedAt,
    signatureMethod: s.signatureMethod ?? undefined,
  };
}

function toPaymentConfig(c: ApiPaymentConfig): DocumentDetailPaymentConfig {
  return {
    fieldId: parseId("signature_fields", c.fieldId),
    totalAmountCents: c.totalAmountCents,
    currency: c.currency,
    paymentType: c.paymentType,
    paymentStatus: c.paymentStatus ?? undefined,
  };
}

function toCurrentUserField(f: ApiSignatureFieldWithValues) {
  return {
    _id: parseId("signature_fields", f.id),
    documentId: parseId("documents", f.documentId),
    recipientId: f.recipientId
      ? parseId("document_recipients", f.recipientId)
      : undefined,
    fieldType: toFieldType(f.fieldType),
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    label: f.label,
    isRequired: f.isRequired,
    isMainSignature: f.isMainSignature,
    currentValue: f.currentValue ?? undefined,
    currentSignatureImageUrl: f.currentSignatureImageUrl ?? undefined,
    isFilled: f.isFilled,
    signatureDetails: f.signatureDetails
      ? {
          ...f.signatureDetails,
          signerName: f.signatureDetails.signerName ?? undefined,
          signerEmail: f.signatureDetails.signerEmail ?? undefined,
          signatureMethod: f.signatureDetails.signatureMethod ?? undefined,
        }
      : undefined,
    properties: toFieldProperties(f.properties),
    validationRules: f.validationRules
      ? {
          min: f.validationRules.min,
          max: f.validationRules.max,
        }
      : undefined,
  };
}

export function useDocumentDetail(documentPublicId: string) {
  const { data: documentData, refetch: refetchDocument } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId],
    queryFn: () => getDocument(documentPublicId),
  });

  const { data: apiRecipients, refetch: refetchRecipients } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId, "recipients"],
    queryFn: () => getDocumentRecipients(documentPublicId),
  });

  const { data: apiProgress } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId, "recipients", "progress"],
    queryFn: () => getRecipientProgress(documentPublicId),
  });

  const progress: DocumentDetailProgress | null = apiProgress
    ? {
        percentComplete: apiProgress.percentage,
        byStatus: {
          signed: apiProgress.byStatus["signed"] ?? 0,
          pending: apiProgress.byStatus["pending"] ?? 0,
          viewed: apiProgress.byStatus["viewed"] ?? 0,
          declined: apiProgress.byStatus["declined"] ?? 0,
        },
      }
    : null;

  const { data: apiSignatureFields, refetch: refetchFields } = useSuspenseQuery(
    {
      queryKey: ["documents", documentPublicId, "signature-fields"],
      queryFn: () => getDocumentSignatureFields(documentPublicId),
    }
  );

  const { data: apiSignatures } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId, "signatures"],
    queryFn: () => getDocumentSignatures(documentPublicId),
  });

  const { data: apiPaymentConfigs } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId, "payment-configs"],
    queryFn: () => getDocumentPaymentConfigs(documentPublicId),
  });

  const {
    data: apiCurrentUserRecipient,
    refetch: refetchCurrentUserRecipient,
  } = useSuspenseQuery({
    queryKey: ["documents", documentPublicId, "recipients", "me"],
    queryFn: () => getCurrentUserRecipient(documentPublicId),
  });

  const { data: apiCurrentUserFields, refetch: refetchCurrentUserFields } =
    useSuspenseQuery({
      queryKey: ["documents", documentPublicId, "signature-fields", "me"],
      queryFn: () => getCurrentUserSignatureFields(documentPublicId),
    });

  const currentUserRecipient = apiCurrentUserRecipient
    ? toRecipient(apiCurrentUserRecipient)
    : null;
  const currentUserFields = (apiCurrentUserFields ?? []).map(
    toCurrentUserField
  );

  const recipients = useMemo(
    () => (apiRecipients ?? []).map(toRecipient),
    [apiRecipients]
  );

  const signatureFields = useMemo(
    () => (apiSignatureFields ?? []).map(toSignatureField),
    [apiSignatureFields]
  );

  const documentSignatures = useMemo(
    () => (apiSignatures ?? []).map(toSignature),
    [apiSignatures]
  );

  const paymentConfigs = useMemo(
    () => (apiPaymentConfigs ?? []).map(toPaymentConfig),
    [apiPaymentConfigs]
  );

  return {
    documentData,
    recipients,
    progress,
    signatureFields,
    documentSignatures,
    paymentConfigs,
    currentUserRecipient,
    currentUserFields,
    refetchDocument,
    refetchRecipients,
    refetchFields,
    refetchCurrentUserRecipient,
    refetchCurrentUserFields,
  };
}
