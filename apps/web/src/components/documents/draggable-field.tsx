import { canvas } from "@seal/tokens/theme";

import {
  FIELD_ICON_SIZE,
  FIELD_PAD_X,
  fieldChrome,
  fieldDisplayLabel,
  fieldTextOffset,
} from "./document-surface";
import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Group,
  Image as KonvaImage,
  Rect,
  Text,
  Transformer,
} from "react-konva";

import { filledFieldText } from "@/lib/field-appearance";

/** Same face as the rest of the product, and as the burned PDF. */
const FIELD_FONT = "'Hedvig Letters Sans', ui-sans-serif, sans-serif";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/field-types";
import { formatMoney, money } from "@/lib/money";

import {
  getRecipientColorById,
  UNASSIGNED_COLOR,
} from "./recipient-colors";

function useSealIcon(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo/seal-mark.svg";
    img.addEventListener("load", () => setImage(img));
  }, []);

  return image;
}

export interface PlacedField {
  id: string;
  fieldType: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  recipientId?: string;
  label?: string;
  properties?: {
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
    helpText?: string;
  };
  /** Payment total in cents for display on canvas */
  paymentTotalCents?: number;
  /** Signature data if field has been filled */
  signatureData?: {
    signatureImageUrl?: string;
    value?: string;
    signedAt?: number;
    signerName?: string;
    signerEmail?: string;
    signatureMethod?: string;
  };
}

interface DraggableFieldProps {
  field: PlacedField;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (x: number, y: number, width: number, height: number) => void;
  /** Map of recipientId to index for color assignment */
  recipientIndexMap?: Map<string, number>;
  /** If true, use recipient colors instead of field type colors */
  useRecipientColors?: boolean;
}

const FIELD_CHROME: FieldColors = fieldChrome();

type FieldColors = {
  readonly ink: string;
  readonly accent: string;
  readonly glow: string;
};

type FieldRenderState = {
  readonly colors: FieldColors;
  readonly isUnassigned: boolean;
  readonly label: string;
};

type FieldRendererProps = {
  readonly field: PlacedField;
  readonly isSelected: boolean;
  readonly colors: FieldColors;
};

type StandardFieldProps = FieldRendererProps & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly sealIcon: HTMLImageElement | null;
};

type SidebarMetrics = {
  readonly iconSize: number;
  readonly sidebarWidth: number;
  readonly textOffsetX: number;
};

/**
 * Field type labels
 */
const FIELD_LABELS: Record<FieldType, string> = {
  ...FIELD_TYPE_LABELS,
  checkbox: "",
};

/**
 * Default field dimensions — re-exported for placement / toolbar
 */
export { FIELD_DIMENSIONS } from "@/lib/field-types";

/**
 * Draggable field on the Konva page. One ink, one icon, no per-type color.
 */
export function DraggableField({
  field,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  recipientIndexMap,
  useRecipientColors = false,
}: DraggableFieldProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const sealIcon = useSealIcon();
  const renderState = getFieldRenderState(
    field,
    recipientIndexMap,
    useRecipientColors
  );

  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(node.x(), node.y());
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    onTransformEnd(
      node.x(),
      node.y(),
      Math.max(30, node.width() * scaleX),
      Math.max(20, node.height() * scaleY)
    );
  };

  return (
    <>
      <Group
        ref={shapeRef}
        x={field.x}
        y={field.y}
        width={field.width}
        height={field.height}
        draggable={isSelected}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <FieldContent
          colors={renderState.colors}
          field={field}
          isSelected={isSelected}
          isUnassigned={renderState.isUnassigned}
          label={renderState.label}
          sealIcon={sealIcon}
        />
      </Group>

      {/* Transformer for resize handles */}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 24 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          rotateEnabled={false}
          borderStroke={renderState.colors.accent}
          borderStrokeWidth={1.5}
          anchorFill={canvas.chrome.anchorFill}
          anchorStroke={renderState.colors.accent}
          anchorStrokeWidth={1.5}
          anchorSize={8}
          anchorCornerRadius={2}
        />
      )}
    </>
  );
}

function getFieldRenderState(
  field: PlacedField,
  recipientIndexMap: Map<string, number> | undefined,
  useRecipientColors: boolean
): FieldRenderState {
  const recipientColor = useRecipientColors
    ? getRecipientColorById(field.recipientId, recipientIndexMap ?? new Map())
    : null;
  return {
    colors: FIELD_CHROME,
    isUnassigned:
      useRecipientColors &&
      (!field.recipientId || recipientColor === UNASSIGNED_COLOR),
    label: fieldDisplayLabel(
      FIELD_LABELS[field.fieldType],
      field.label
    ),
  };
}

function FieldContent({
  colors,
  field,
  isSelected,
  isUnassigned,
  label,
  sealIcon,
}: StandardFieldProps) {
  if (field.signatureData?.signedAt) {
    return (
      <FilledFieldStamp
        colors={colors}
        field={field}
        isSelected={isSelected}
        sealIcon={sealIcon}
      />
    );
  }
  if (field.fieldType === "checkbox") {
    return (
      <CheckboxField colors={colors} field={field} isSelected={isSelected} />
    );
  }
  return (
    <StandardField
      colors={colors}
      field={field}
      isSelected={isSelected}
      isUnassigned={isUnassigned}
      label={label}
      sealIcon={sealIcon}
    />
  );
}

function CheckboxField({ colors, field, isSelected }: FieldRendererProps) {
  const options = field.properties?.options;
  return options && options.length > 0 ? (
    <CheckboxGroupField
      colors={colors}
      field={field}
      isSelected={isSelected}
      options={options}
    />
  ) : (
    <SingleCheckboxField
      colors={colors}
      field={field}
      isSelected={isSelected}
    />
  );
}

function SingleCheckboxField({
  colors,
  field,
  isSelected,
}: FieldRendererProps) {
  const safeSize = Math.max(16, Math.min(field.width, field.height) - 6);
  const x = (field.width - safeSize) / 2;
  const y = (field.height - safeSize) / 2;
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={safeSize}
        height={safeSize}
        cornerRadius={4}
        stroke={colors.accent}
        strokeWidth={isSelected ? 2 : 1.5}
        fill={canvas.chrome.background}
      />
      <Text
        x={x}
        y={y}
        width={safeSize}
        height={safeSize}
        align="center"
        verticalAlign="middle"
        text="✓"
        fontSize={safeSize * 0.65}
        fontFamily="system-ui, sans-serif"
        fill={colors.accent}
        opacity={0.5}
        listening={false}
      />
    </>
  );
}

function CheckboxGroupField({
  colors,
  field,
  isSelected,
  options,
}: FieldRendererProps & {
  readonly options: readonly string[];
}) {
  return (
    <>
      <FieldBackground
        colors={colors}
        field={field}
        isSelected={isSelected}
        dashed
      />
      {field.label ? (
        <CheckboxGroupTitle
          colors={colors}
          label={fieldDisplayLabel(FIELD_LABELS[field.fieldType], field.label)}
        />
      ) : null}
      {options.map((option, index) => (
        <CheckboxOption
          key={option}
          colors={colors}
          field={field}
          index={index}
          option={option}
        />
      ))}
    </>
  );
}

function CheckboxGroupTitle({
  colors,
  label,
}: Pick<FieldRendererProps, "colors"> & { readonly label: string }) {
  return (
    <Text
      x={FIELD_PAD_X}
      y={10}
      text={label}
      fontSize={10}
      fontFamily={FIELD_FONT}
      fontStyle="600"
      fill={colors.ink}
      opacity={0.7}
      listening={false}
    />
  );
}

function CheckboxOption({
  colors,
  field,
  index,
  option,
}: {
  readonly colors: FieldColors;
  readonly field: PlacedField;
  readonly index: number;
  readonly option: string;
}) {
  const checkboxSize = 14;
  const padding = FIELD_PAD_X;
  const yPos = (field.label ? padding + 18 : padding) + index * 24;
  return (
    <Group x={padding} y={yPos}>
      <Rect
        width={checkboxSize}
        height={checkboxSize}
        cornerRadius={3}
        stroke={colors.accent}
        strokeWidth={1.5}
        fill={canvas.chrome.background}
      />
      <Text
        width={checkboxSize}
        height={checkboxSize}
        align="center"
        verticalAlign="middle"
        text="✓"
        fontSize={10}
        fontFamily="system-ui, sans-serif"
        fill={colors.accent}
        opacity={0.3}
        listening={false}
      />
      <Text
        x={checkboxSize + 6}
        y={1}
        text={option}
        fontSize={11}
        fontFamily={FIELD_FONT}
        fill={canvas.chrome.optionText}
        listening={false}
      />
    </Group>
  );
}

function StandardField({
  colors,
  field,
  isSelected,
  isUnassigned,
  label,
  sealIcon,
}: StandardFieldProps) {
  const metrics = sealSidebarMetrics(field, sealIcon, 12);
  return (
    <>
      <StandardFieldBackground
        colors={colors}
        field={field}
        isSelected={isSelected}
        isUnassigned={isUnassigned}
      />
      <SealMark field={field} metrics={metrics} sealIcon={sealIcon} />
      <StandardFieldLabel
        colors={colors}
        field={field}
        isUnassigned={isUnassigned}
        label={label}
        textOffsetX={metrics.textOffsetX}
      />
    </>
  );
}

function StandardFieldBackground({
  colors,
  field,
  isSelected,
  isUnassigned,
}: FieldRendererProps & {
  readonly isUnassigned: boolean;
}) {
  return (
    <Rect
      width={field.width}
      height={field.height}
      fill={
        isUnassigned
          ? canvas.chrome.backgroundUnassigned
          : canvas.chrome.background
      }
      stroke={isSelected ? colors.accent : canvas.chrome.borderUnselected}
      strokeWidth={isSelected ? 2 : 1}
      cornerRadius={6}
      shadowColor={isSelected ? colors.glow : canvas.chrome.shadowUnselected}
      shadowBlur={isSelected ? 12 : 4}
      shadowOpacity={1}
      shadowOffsetY={isSelected ? 0 : 2}
      dash={isUnassigned ? [4, 4] : undefined}
      dashEnabled={isUnassigned}
    />
  );
}

function FieldBackground({
  colors,
  dashed,
  field,
  isSelected,
}: FieldRendererProps & {
  readonly dashed?: boolean;
}) {
  return (
    <Rect
      width={field.width}
      height={field.height}
      fill={canvas.chrome.background}
      stroke={
        isSelected ? canvas.chrome.ink : canvas.chrome.borderUnselected
      }
      strokeWidth={isSelected ? 2 : 1}
      cornerRadius={6}
      shadowColor={isSelected ? colors.glow : canvas.chrome.shadowCheckbox}
      shadowBlur={isSelected ? 12 : 4}
      shadowOpacity={1}
      shadowOffsetY={isSelected ? 0 : 2}
      dash={[6, 3]}
      dashEnabled={Boolean(dashed && !isSelected)}
    />
  );
}

function SealMark({
  field,
  metrics,
  sealIcon,
}: {
  readonly field: PlacedField;
  readonly metrics: SidebarMetrics;
  readonly sealIcon: HTMLImageElement | null;
}) {
  if (!sealIcon) return null;
  return (
    <KonvaImage
      image={sealIcon}
      x={FIELD_PAD_X}
      y={(field.height - metrics.iconSize) / 2}
      width={metrics.iconSize}
      height={metrics.iconSize}
      listening={false}
    />
  );
}

function StandardFieldLabel({
  colors,
  field,
  isUnassigned,
  label,
  textOffsetX,
}: Pick<FieldRendererProps, "colors" | "field"> & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly textOffsetX: number;
}) {
  if (!label) return null;
  return field.fieldType === "payment" &&
    field.paymentTotalCents !== undefined ? (
    <PaymentFieldLabel
      colors={colors}
      field={field}
      isUnassigned={isUnassigned}
      label={label}
      textOffsetX={textOffsetX}
    />
  ) : (
    <Text
      x={textOffsetX}
      y={0}
      width={Math.max(0, field.width - textOffsetX - FIELD_PAD_X)}
      height={field.height}
      text={isUnassigned ? `${label} (unassigned)` : label}
      fontSize={11}
      fontFamily={FIELD_FONT}
      fontStyle="600"
      fill={colors.ink}
      opacity={isUnassigned ? 0.6 : 1}
      align="left"
      verticalAlign="middle"
      wrap="none"
      ellipsis
      listening={false}
    />
  );
}

function PaymentFieldLabel({
  colors,
  field,
  isUnassigned,
  label,
  textOffsetX,
}: Pick<FieldRendererProps, "colors" | "field"> & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly textOffsetX: number;
}) {
  return (
    <>
      <Text
        x={textOffsetX}
        y={8}
        width={field.width - textOffsetX - 4}
        height={field.height / 2 - 4}
        text={isUnassigned ? `${label} (unassigned)` : label}
        fontSize={10}
        fontFamily={FIELD_FONT}
        fontStyle="600"
        fill={colors.ink}
        opacity={isUnassigned ? 0.6 : 0.7}
        align="left"
        verticalAlign="top"
        letterSpacing={0.3}
        listening={false}
      />
      <Text
        x={textOffsetX}
        y={field.height / 2 - 2}
        width={field.width - textOffsetX - 4}
        height={field.height / 2}
        text={formatPaymentTotal(field.paymentTotalCents)}
        fontSize={16}
        fontFamily={FIELD_FONT}
        fontStyle="700"
        fill={colors.accent}
        opacity={0.9}
        align="left"
        verticalAlign="top"
        letterSpacing={0.3}
        listening={false}
      />
    </>
  );
}

function FilledFieldStamp({
  field,
}: FieldRendererProps & {
  readonly sealIcon: HTMLImageElement | null;
}) {
  const image = useLoadedImage(field.signatureData?.signatureImageUrl);
  const text = filledFieldText(field.fieldType, field.signatureData?.value);
  return (
    <>
      <Rect
        width={field.width}
        height={field.height}
        fill="#ffffff"
        listening={false}
      />
      {image ? (
        <KonvaImage
          image={image}
          x={2}
          y={2}
          width={Math.max(field.width - 4, 1)}
          height={Math.max(field.height - 4, 1)}
          listening={false}
        />
      ) : (
        <Text
          x={4}
          y={2}
          width={Math.max(field.width - 8, 1)}
          height={Math.max(field.height - 4, 1)}
          text={text}
          fontSize={Math.min(12, Math.max(8, field.height * 0.45))}
          fontFamily={FIELD_FONT}
          fill={canvas.chrome.ink}
          verticalAlign="middle"
          wrap="word"
          listening={false}
        />
      )}
    </>
  );
}

function useLoadedImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = src;
    return () => {
      next.onload = null;
    };
  }, [src]);
  return image;
}

function sealSidebarMetrics(
  field: PlacedField,
  sealIcon: HTMLImageElement | null,
  noIconTextOffsetX: number
): SidebarMetrics {
  const iconSize = Math.min(FIELD_ICON_SIZE, Math.max(10, field.height - 16));
  return {
    iconSize,
    sidebarWidth: iconSize,
    textOffsetX: sealIcon ? fieldTextOffset(true) : noIconTextOffsetX,
  };
}

function formatPaymentTotal(paymentTotalCents: number | undefined): string {
  return formatMoney(money(paymentTotalCents ?? 0, "USD"));
}
