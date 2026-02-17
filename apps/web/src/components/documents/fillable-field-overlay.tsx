import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CreditCardIcon,
  FileIcon,
  HashIcon,
  PenToolIcon,
  StarIcon,
  TypeIcon,
} from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";

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
  fieldId: Id<"signature_fields">;
  fieldType: FieldType;
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
  isActive?: boolean;
  validationError?: string;
  signatureDetails?: SignatureDetails;
  paymentInfo?: PaymentInfo;
  onClick: (fieldId: Id<"signature_fields">) => void;
}

function getFieldIcon(fieldType: FieldType) {
  switch (fieldType) {
    case "signature":
      return <PenToolIcon className="h-3 w-3" />;
    case "text":
      return <TypeIcon className="h-3 w-3" />;
    case "number":
      return <HashIcon className="h-3 w-3" />;
    case "date":
      return <CalendarIcon className="h-3 w-3" />;
    case "checkbox":
      return <CheckSquareIcon className="h-3 w-3" />;
    case "dropdown":
      return <ChevronDownIcon className="h-3 w-3" />;
    case "radio":
      return <CircleDotIcon className="h-3 w-3" />;
    case "attachment":
      return <FileIcon className="h-3 w-3" />;
    case "payment":
      return <CreditCardIcon className="h-3 w-3" />;
    default:
      return <TypeIcon className="h-3 w-3" />;
  }
}

function getFieldTypeLabel(fieldType: FieldType): string {
  switch (fieldType) {
    case "signature":
      return "Signature";
    case "text":
      return "Text";
    case "number":
      return "Number";
    case "date":
      return "Date";
    case "checkbox":
      return "Checkbox";
    case "dropdown":
      return "Dropdown";
    case "radio":
      return "Radio";
    case "attachment":
      return "Attachment";
    case "payment":
      return "Payment";
    default:
      return fieldType;
  }
}

// Format date for signature stamp display
function formatSignatureDate(timestamp: number): {
  date: string;
  time: string;
} {
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function getSealIconSize(height: number, width: number): number {
  const baseDimension = Math.min(height, width);
  return Math.max(10, Math.min(20, baseDimension * 0.5));
}

function SealFieldIcon({ size, containerHeight }: { size: number; containerHeight: number }) {
  const containerWidth = size + 6;
  return (
    <div
      className="flex items-center justify-center rounded-l-sm border-r border-gray-200/50 bg-white/95 shadow-sm"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
    >
      <img
        src="/logo/seal-icon-color-no-background.svg"
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

export const FillableFieldOverlay = forwardRef<HTMLButtonElement, FillableFieldOverlayProps>(
  function FillableFieldOverlay(
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
      isActive = false,
      validationError,
      signatureDetails,
      paymentInfo,
      onClick,
    },
    ref,
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

    // Check if this is a filled field that should show the stamp
    const isFilledField = isFilled && signatureDetails;

    // Format signature date if available
    const formattedDate = signatureDetails ? formatSignatureDate(signatureDetails.signedAt) : null;

    const sealIconSize = getSealIconSize(absoluteHeight, absoluteWidth);

    if (isFilledField && signatureDetails) {
      return (
        <div
          className="absolute overflow-hidden rounded-sm border border-gray-300 bg-gray-50/80"
          style={{
            left: `${absoluteX}px`,
            top: `${absoluteY}px`,
            width: `${absoluteWidth}px`,
            height: `${absoluteHeight}px`,
          }}
        >
          <div className="absolute top-0 left-0 z-20">
            <SealFieldIcon size={sealIconSize} containerHeight={absoluteHeight} />
          </div>
          {absoluteHeight >= 50 && (
            <div
              className="flex h-full flex-col justify-center bg-white/90 py-2 pr-2"
              style={{ paddingLeft: sealIconSize + 12 }}
            >
              <div className="flex flex-col gap-0.5">
                {/* Field type */}
                <div className="flex items-baseline gap-1">
                  <span className="text-[9px] text-gray-500">{getFieldTypeLabel(fieldType)}</span>
                </div>
                {/* Signer name */}
                <div className="flex items-baseline gap-1">
                  <span className="text-[9px] text-gray-500">Signed by:</span>
                  <span className="truncate text-[10px] font-semibold text-gray-800">
                    {signatureDetails.signerName || signatureDetails.signerEmail}
                  </span>
                </div>
                {/* Date and time */}
                {formattedDate && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[9px] text-gray-500">Date:</span>
                    <span className="text-[9px] text-gray-700">
                      {formattedDate.date} at {formattedDate.time}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {absoluteHeight < 50 && absoluteHeight >= 30 && (
            <div
              className="flex h-full flex-col justify-center bg-white/90 py-0.5 pr-1"
              style={{ paddingLeft: sealIconSize + 10 }}
            >
              <div className="text-[7px] text-gray-600">
                <div className="truncate font-medium">{getFieldTypeLabel(fieldType)}</div>
                <div className="mt-0.5 truncate text-[6px]">
                  {signatureDetails.signerName || signatureDetails.signerEmail}
                </div>
                {formattedDate && (
                  <div className="mt-0.5 truncate text-[6px]">
                    {formattedDate.date} at {formattedDate.time}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onClick(fieldId)}
        className={cn(
          "group absolute cursor-pointer rounded-sm border-2 transition-all",
          "hover:border-primary hover:bg-primary/5",
          "flex items-center justify-center text-xs",
          isFilled
            ? "border-green-500 bg-green-50/50"
            : isRequired
              ? "border-red-400 bg-red-50/30"
              : "border-blue-400 bg-blue-50/30",
          isActive && "ring-primary border-primary animate-pulse ring-2 ring-offset-2",
          isMainSignature && !isActive && "ring-2 ring-yellow-500",
        )}
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
            {isMainSignature && <StarIcon className="h-3 w-3 text-yellow-600" />}
            {getFieldIcon(fieldType)}
            {absoluteWidth > 80 && (
              <span className="max-w-[60px] truncate text-[10px] font-medium">
                {getFieldTypeLabel(fieldType)}
              </span>
            )}
          </div>
          {isFilled && absoluteHeight > 25 && (
            <div className="text-[9px] font-medium text-green-700">
              {fieldType === "payment" && paymentInfo
                ? `✓ ${paymentInfo.paymentStatus === "paid" ? "Paid" : "Pending"}`
                : "✓ Filled"}
            </div>
          )}
          {!isFilled && isRequired && absoluteHeight > 25 && (
            <div className="text-[9px] font-medium text-red-700">Required</div>
          )}
          {fieldType === "payment" && paymentInfo && absoluteHeight > 25 && (
            <div className="text-[9px] font-semibold text-emerald-700">
              {formatCurrency(paymentInfo.totalAmountCents, paymentInfo.currency)}
            </div>
          )}
          {isMainSignature && absoluteHeight > 30 && (
            <div className="text-[8px] font-medium text-yellow-700">Document Signature</div>
          )}
        </div>

        {/* Hover tooltip for smaller fields */}
        <div className="bg-popover text-popover-foreground absolute top-full left-0 z-10 mt-1 hidden rounded-md border p-2 text-xs whitespace-nowrap shadow-md group-hover:block">
          <div className="font-medium">{label}</div>
          <div className="text-muted-foreground text-[10px]">
            {getFieldTypeLabel(fieldType)}
            {isRequired && " • Required"}
            {fieldType === "payment" && paymentInfo && (
              <span className="ml-1 font-semibold text-emerald-700">
                • {formatCurrency(paymentInfo.totalAmountCents, paymentInfo.currency)}
              </span>
            )}
          </div>

          {validationError && (
            <div className="text-destructive mt-1 max-w-[200px] text-[10px]">
              ⚠ {validationError}
            </div>
          )}
        </div>
      </button>
    );
  },
);
