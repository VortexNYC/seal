import { Button } from "@cloudflare/kumo/components/button";
import { Calendar as CalendarIcon, CaretDown as ChevronDownIcon, CheckSquare as CheckSquareIcon, RadioButton as CircleDotIcon, CreditCard as CreditCardIcon, File as FileIcon, Hash as HashIcon, PenNib as PenToolIcon, Star as StarIcon, TextT as TypeIcon } from "@phosphor-icons/react";
import { forwardRef } from "react";

import { filledFieldText } from "@/lib/field-appearance";
import { FIELD_TYPE_LABELS, isFieldType } from "@/lib/field-types";
import { formatMoney, money } from "@/lib/money";

interface SignatureDetails {
  signedAt: number;
  signerName?: string;
  signerEmail?: string;
  signatureMethod?: string;
}

interface PaymentInfo {
  totalAmountCents: number;
  currency: string;
  paymentStatus?: string;
}

interface FillableFieldOverlayProps {
  fieldId: string;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isMainSignature?: boolean;
  x: number; // Percentage
  y: number; // Percentage
  width: number; // Percentage
  height: number; // Percentage
  page: number;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
  isFilled: boolean;
  currentValue?: string | null;
  currentSignatureImageUrl?: string | null;
  isActive?: boolean;
  validationError?: string;
  signatureDetails?: SignatureDetails;
  paymentInfo?: PaymentInfo;
  onClick: (fieldId: string) => void;
}

function getFieldIcon(fieldType: string) {
  switch (fieldType) {
    case "signature":
    case "free_signature":
      return <PenToolIcon className="h-3 w-3" />;
    case "text":
    case "name":
    case "email":
    case "initials":
    case "heading":
    case "strikethrough":
      return <TypeIcon className="h-3 w-3" />;
    case "number":
    case "cells":
      return <HashIcon className="h-3 w-3" />;
    case "date":
    case "date_signed":
      return <CalendarIcon className="h-3 w-3" />;
    case "checkbox":
    case "multi_select":
      return <CheckSquareIcon className="h-3 w-3" />;
    case "dropdown":
      return <ChevronDownIcon className="h-3 w-3" />;
    case "radio":
      return <CircleDotIcon className="h-3 w-3" />;
    case "attachment":
    case "image":
    case "stamp":
      return <FileIcon className="h-3 w-3" />;
    case "payment":
      return <CreditCardIcon className="h-3 w-3" />;
    default:
      return <TypeIcon className="h-3 w-3" />;
  }
}

function getFieldTypeLabel(fieldType: string): string {
  if (isFieldType(fieldType)) {
    return FIELD_TYPE_LABELS[fieldType];
  }
  return fieldType;
}

function formatCurrency(amountCents: number, currency: string): string {
  return formatMoney(money(amountCents, currency.toUpperCase()), {
    locale: "en-US",
    intl: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  });
}

function getSealIconSize(height: number, width: number): number {
  const baseDimension = Math.min(height, width);
  return Math.max(10, Math.min(20, baseDimension * 0.5));
}

function SealFieldIcon({
  size,
  containerHeight,
}: {
  size: number;
  containerHeight: number;
}) {
  const containerWidth = size + 6;
  return (
    <div
      className="bg-kumo-base/95 flex items-center justify-center rounded-l-sm border-r shadow-sm"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
    >
      <img
        src="/logo/seal-mark.svg"
        alt=""
        aria-hidden="true"
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  );
}

export const FillableFieldOverlay = forwardRef<
  HTMLButtonElement,
  FillableFieldOverlayProps
>(function FillableFieldOverlay(
  {
    fieldId,
    fieldType,
    label,
    isRequired,
    isMainSignature = false,
    x,
    y,
    width,
    height,
    page,
    currentPage,
    pdfPageWidth,
    pdfPageHeight,
    isFilled,
    currentValue,
    currentSignatureImageUrl,
    isActive = false,
    validationError,
    signatureDetails,
    paymentInfo,
    onClick,
  },
  ref
) {
  // Only render on the correct page
  if (page !== currentPage) {
    return null;
  }

  // Calculate absolute position from percentages
  const absoluteX = (x / 100) * pdfPageWidth;
  const absoluteY = (y / 100) * pdfPageHeight;
  const absoluteWidth = (width / 100) * pdfPageWidth;
  const absoluteHeight = (height / 100) * pdfPageHeight;

  const isFilledField = isFilled && signatureDetails;
  const sealIconSize = getSealIconSize(absoluteHeight, absoluteWidth);

  if (isFilledField && signatureDetails) {
    const appearance = filledFieldText(fieldType, currentValue);
    return (
      <div
        className="absolute overflow-hidden bg-white"
        style={{
          left: `${absoluteX}px`,
          top: `${absoluteY}px`,
          width: `${absoluteWidth}px`,
          height: `${absoluteHeight}px`,
        }}
      >
        {currentSignatureImageUrl ? (
          <img
            src={currentSignatureImageUrl}
            alt=""
            className="h-full w-full object-contain object-bottom"
          />
        ) : (
          <div className="text-kumo-default flex h-full items-center px-1 font-sans text-[11px] leading-tight break-all">
            {appearance}
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      ref={ref}
      type="button"
      variant={isFilled ? "secondary" : isRequired ? "destructive" : "outline"}
      onClick={() => onClick(fieldId)}
      aria-label={`${label} ${isRequired ? "required " : ""}field, ${getFieldTypeLabel(fieldType)}${isMainSignature ? ", main signature" : ""}`}
      data-seal-field-active={isActive ? "true" : undefined}
      className="absolute p-0"
      style={{
        left: `${absoluteX}px`,
        top: `${absoluteY}px`,
        width: `${absoluteWidth}px`,
        height: `${absoluteHeight}px`,
      }}
      title={`${label}${isRequired ? " (Required)" : ""}${isMainSignature ? " - Main Signature" : ""} - Click to fill`}
    >
      <div className="absolute top-0 left-0 z-20">
        <SealFieldIcon size={sealIconSize} containerHeight={absoluteHeight} />
      </div>
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1"
        style={{ paddingLeft: sealIconSize + 10 }}
      >
        <div className="flex items-center gap-1">
          {isMainSignature && <StarIcon className="text-kumo-warning h-3 w-3" />}
          {getFieldIcon(fieldType)}
          {absoluteWidth > 80 && (
            <span className="text-xs max-w-15 truncate font-medium">
              {getFieldTypeLabel(fieldType)}
            </span>
          )}
        </div>
        {isFilled && absoluteHeight > 25 && (
          <div className="text-kumo-success text-xs font-medium">
            {fieldType === "payment" && paymentInfo
              ? `✓ ${paymentInfo.paymentStatus === "paid" ? "Paid" : "Pending"}`
              : "✓ Filled"}
          </div>
        )}
        {!isFilled && isRequired && absoluteHeight > 25 && (
          <div className="text-kumo-danger text-xs font-medium">Required</div>
        )}
        {fieldType === "payment" && paymentInfo && absoluteHeight > 25 && (
          <div className="text-kumo-info text-xs font-semibold">
            {paymentInfo.paymentStatus === "paid" ? "✓ " : ""}
            {formatCurrency(paymentInfo.totalAmountCents, paymentInfo.currency)}
          </div>
        )}
        {isMainSignature && absoluteHeight > 30 && (
          <div className="text-kumo-warning text-xs font-medium">
            Document Signature
          </div>
        )}
      </div>

      {/* Tooltip for smaller fields — visible on hover and focus */}
      <div className="bg-kumo-elevated text-kumo-default absolute top-full left-0 z-10 mt-1 hidden rounded-md border p-2 text-xs whitespace-nowrap shadow-md group-hover:block group-focus:block">
        <div className="font-medium">{label}</div>
        <div className="text-kumo-secondary text-xs">
          {getFieldTypeLabel(fieldType)}
          {isRequired && " • Required"}
          {fieldType === "payment" && paymentInfo && (
            <span className="text-kumo-info ml-1 font-semibold">
              • {paymentInfo.paymentStatus === "paid" ? "Paid " : ""}
              {formatCurrency(
                paymentInfo.totalAmountCents,
                paymentInfo.currency
              )}
            </span>
          )}
        </div>

        {validationError && (
          <div className="text-kumo-danger text-xs mt-1 max-w-50">
            ⚠ {validationError}
          </div>
        )}
      </div>
    </Button>
  );
});
