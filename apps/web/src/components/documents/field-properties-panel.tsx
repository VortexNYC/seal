/**
 * Field Properties Panel Component
 *
 * SEA-92: Side panel for configuring field properties after placement.
 * Allows users to edit label, required status, placeholder, help text,
 * and validation rules for signature fields.
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckSquareIcon,
	HelpCircleIcon,
	PenToolIcon,
	TypeIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import type { FieldType } from "./field-toolbar";

// Common validation patterns
type ValidationPatternOption = {
	value: string;
	label: string;
	pattern?: string;
};

const VALIDATION_PATTERNS: ValidationPatternOption[] = [
	{ value: "", label: "None" },
	{ value: "email", label: "Email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
	{ value: "phone", label: "Phone Number", pattern: "^[+]?[0-9\\s\\-()]+$" },
	{ value: "number", label: "Numbers Only", pattern: "^[0-9]+$" },
	{ value: "alphanumeric", label: "Alphanumeric", pattern: "^[a-zA-Z0-9]+$" },
	{ value: "url", label: "URL", pattern: "^https?:\\/\\/.+" },
	{ value: "custom", label: "Custom Pattern" },
];

interface FieldData {
	_id: Id<"signature_fields">;
	fieldType: FieldType;
	label: string;
	isRequired: boolean;
	recipientId: Id<"document_recipients">;
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
		required?: boolean;
		min?: number;
		max?: number;
		pattern?: string;
		customMessage?: string;
	};
}

interface Recipient {
	_id: Id<"document_recipients">;
	name?: string;
	email: string;
}

interface FieldPropertiesPanelProps {
	field: FieldData;
	recipients: Recipient[];
	onClose: () => void;
}

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
	signature: <PenToolIcon className="h-4 w-4" />,
	text: <TypeIcon className="h-4 w-4" />,
	date: <CalendarIcon className="h-4 w-4" />,
	checkbox: <CheckSquareIcon className="h-4 w-4" />,
	dropdown: <TypeIcon className="h-4 w-4" />,
	radio: <CheckSquareIcon className="h-4 w-4" />,
	attachment: <TypeIcon className="h-4 w-4" />,
};

const FIELD_COLORS: Record<FieldType, string> = {
	signature: "bg-blue-100 text-blue-700 border-blue-200",
	text: "bg-green-100 text-green-700 border-green-200",
	date: "bg-purple-100 text-purple-700 border-purple-200",
	checkbox: "bg-orange-100 text-orange-700 border-orange-200",
	dropdown: "bg-cyan-100 text-cyan-700 border-cyan-200",
	radio: "bg-pink-100 text-pink-700 border-pink-200",
	attachment: "bg-lime-100 text-lime-700 border-lime-200",
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
	signature: "Signature",
	text: "Text",
	date: "Date",
	checkbox: "Checkbox",
	dropdown: "Dropdown",
	radio: "Radio",
	attachment: "Attachment",
};

export function FieldPropertiesPanel({
	field,
	recipients,
	onClose,
}: FieldPropertiesPanelProps) {
	// Local state for form fields
	const [label, setLabel] = useState(field.label);
	const [isRequired, setIsRequired] = useState(field.isRequired);
	const [placeholder, setPlaceholder] = useState(
		field.properties?.placeholder ?? "",
	);
	const [helpText, setHelpText] = useState(field.properties?.helpText ?? "");
	const [maxLength, setMaxLength] = useState<number | undefined>(
		field.properties?.maxLength,
	);
	const [minLength, setMinLength] = useState<number | undefined>(
		field.properties?.minLength,
	);
	const [validationPattern, setValidationPattern] = useState(() => {
		const pattern = field.properties?.pattern;
		if (!pattern) return "";
		const found = VALIDATION_PATTERNS.find((p) => p.pattern === pattern);
		return found ? found.value : "custom";
	});
	const [customPattern, setCustomPattern] = useState(
		field.properties?.pattern ?? "",
	);
	const [customMessage, setCustomMessage] = useState(
		field.validationRules?.customMessage ?? "",
	);

	// Track if there are unsaved changes
	const [isSaving, setIsSaving] = useState(false);

	// Update local state when field changes
	useEffect(() => {
		setLabel(field.label);
		setIsRequired(field.isRequired);
		setPlaceholder(field.properties?.placeholder ?? "");
		setHelpText(field.properties?.helpText ?? "");
		setMaxLength(field.properties?.maxLength);
		setMinLength(field.properties?.minLength);
		setCustomMessage(field.validationRules?.customMessage ?? "");

		const pattern = field.properties?.pattern;
		if (!pattern) {
			setValidationPattern("");
			setCustomPattern("");
		} else {
			const found = VALIDATION_PATTERNS.find((p) => p.pattern === pattern);
			if (found) {
				setValidationPattern(found.value);
				setCustomPattern("");
			} else {
				setValidationPattern("custom");
				setCustomPattern(pattern);
			}
		}
	}, [field]);

	const updateField = useMutation(api.signature_fields.mutations.updateField);

	// Debounced save function
	const saveChanges = useCallback(async () => {
		setIsSaving(true);

		// Determine the pattern to use
		let patternToSave: string | undefined;
		if (validationPattern === "custom" && customPattern) {
			patternToSave = customPattern;
		} else if (validationPattern && validationPattern !== "custom") {
			const found = VALIDATION_PATTERNS.find(
				(p) => p.value === validationPattern,
			);
			patternToSave = found?.pattern;
		}

		try {
			await updateField({
				fieldId: field._id,
				label,
				isRequired,
				properties: {
					placeholder: placeholder || undefined,
					helpText: helpText || undefined,
					maxLength: maxLength || undefined,
					minLength: minLength || undefined,
					pattern: patternToSave,
					// Preserve existing options
					options: field.properties?.options,
					defaultValue: field.properties?.defaultValue,
				},
				validationRules: {
					required: isRequired,
					pattern: patternToSave,
					customMessage: customMessage || undefined,
					// Preserve existing min/max
					min: field.validationRules?.min,
					max: field.validationRules?.max,
				},
			});

			toast.success("Field updated");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update field";
			toast.error(errorMessage);
		} finally {
			setIsSaving(false);
		}
	}, [
		field._id,
		field.properties?.options,
		field.properties?.defaultValue,
		field.validationRules?.min,
		field.validationRules?.max,
		label,
		isRequired,
		placeholder,
		helpText,
		maxLength,
		minLength,
		validationPattern,
		customPattern,
		customMessage,
		updateField,
	]);

	// Auto-save on blur or after a delay
	const handleBlur = useCallback(() => {
		saveChanges();
	}, [saveChanges]);

	// Get recipient info
	const recipient = recipients.find((r) => r._id === field.recipientId);

	// Determine which fields to show based on field type
	const showPlaceholder =
		field.fieldType === "text" || field.fieldType === "date";
	const showValidation = field.fieldType === "text";
	const showLengthLimits = field.fieldType === "text";

	return (
		<div className="field-properties-panel border-l bg-background h-full flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-2">
					<div
						className={`p-1.5 rounded-md border ${FIELD_COLORS[field.fieldType]}`}
					>
						{FIELD_ICONS[field.fieldType]}
					</div>
					<div>
						<h3 className="font-medium text-sm">Field Properties</h3>
						<p className="text-xs text-muted-foreground">
							{FIELD_TYPE_LABELS[field.fieldType]} Field
						</p>
					</div>
				</div>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<XIcon className="h-4 w-4" />
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* Assigned Recipient */}
				{recipient && (
					<div className="space-y-2">
						<Label className="text-xs text-muted-foreground">Assigned to</Label>
						<div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
							<div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
								{(recipient.name || recipient.email)[0].toUpperCase()}
							</div>
							<span className="text-sm truncate">
								{recipient.name || recipient.email}
							</span>
						</div>
					</div>
				)}

				{/* Label */}
				<div className="space-y-2">
					<Label htmlFor="field-label">Label</Label>
					<Input
						id="field-label"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						onBlur={handleBlur}
						placeholder="Enter field label"
					/>
					<p className="text-xs text-muted-foreground">
						The name displayed on the field
					</p>
				</div>

				{/* Required Toggle */}
				<div className="flex items-center justify-between">
					<div className="space-y-0.5">
						<Label htmlFor="field-required">Required</Label>
						<p className="text-xs text-muted-foreground">
							Must be filled before submission
						</p>
					</div>
					<Switch
						id="field-required"
						checked={isRequired}
						onCheckedChange={(checked) => {
							setIsRequired(checked);
							// Save immediately on toggle
							setTimeout(() => saveChanges(), 0);
						}}
					/>
				</div>

				{/* Placeholder (for text and date fields) */}
				{showPlaceholder && (
					<div className="space-y-2">
						<Label htmlFor="field-placeholder">Placeholder</Label>
						<Input
							id="field-placeholder"
							value={placeholder}
							onChange={(e) => setPlaceholder(e.target.value)}
							onBlur={handleBlur}
							placeholder="Enter placeholder text"
						/>
						<p className="text-xs text-muted-foreground">
							Shown when the field is empty
						</p>
					</div>
				)}

				{/* Help Text */}
				<div className="space-y-2">
					<Label htmlFor="field-help">
						<span className="flex items-center gap-1.5">
							<HelpCircleIcon className="h-3.5 w-3.5" />
							Help Text
						</span>
					</Label>
					<Textarea
						id="field-help"
						value={helpText}
						onChange={(e) => setHelpText(e.target.value)}
						onBlur={handleBlur}
						placeholder="Add instructions for the signer"
						rows={2}
					/>
					<p className="text-xs text-muted-foreground">
						Additional guidance for the recipient
					</p>
				</div>

				{/* Validation Section (for text fields) */}
				{showValidation && (
					<div className="space-y-4 pt-2 border-t">
						<div className="flex items-center gap-2">
							<AlertCircleIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">Validation</span>
						</div>

						{/* Validation Pattern */}
						<div className="space-y-2">
							<Label htmlFor="field-validation">Format</Label>
							<Select
								value={validationPattern}
								onValueChange={(value) => {
									setValidationPattern(value);
									if (value !== "custom") {
										setCustomPattern("");
										// Save after pattern change
										setTimeout(() => saveChanges(), 0);
									}
								}}
							>
								<SelectTrigger id="field-validation">
									<SelectValue placeholder="Select format" />
								</SelectTrigger>
								<SelectContent>
									{VALIDATION_PATTERNS.map((pattern) => (
										<SelectItem key={pattern.value} value={pattern.value}>
											{pattern.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Custom Pattern */}
						{validationPattern === "custom" && (
							<div className="space-y-2">
								<Label htmlFor="field-custom-pattern">
									Custom Pattern (Regex)
								</Label>
								<Input
									id="field-custom-pattern"
									value={customPattern}
									onChange={(e) => setCustomPattern(e.target.value)}
									onBlur={handleBlur}
									placeholder="^[a-zA-Z]+$"
									className="font-mono text-sm"
								/>
							</div>
						)}

						{/* Custom Error Message */}
						{validationPattern && (
							<div className="space-y-2">
								<Label htmlFor="field-error-message">Error Message</Label>
								<Input
									id="field-error-message"
									value={customMessage}
									onChange={(e) => setCustomMessage(e.target.value)}
									onBlur={handleBlur}
									placeholder="Please enter a valid value"
								/>
								<p className="text-xs text-muted-foreground">
									Shown when validation fails
								</p>
							</div>
						)}
					</div>
				)}

				{/* Length Limits (for text fields) */}
				{showLengthLimits && (
					<div className="space-y-4 pt-2 border-t">
						<span className="text-sm font-medium">Length Limits</span>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="field-min-length">Min Length</Label>
								<Input
									id="field-min-length"
									type="number"
									min={0}
									value={minLength ?? ""}
									onChange={(e) =>
										setMinLength(
											e.target.value
												? Number.parseInt(e.target.value, 10)
												: undefined,
										)
									}
									onBlur={handleBlur}
									placeholder="0"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="field-max-length">Max Length</Label>
								<Input
									id="field-max-length"
									type="number"
									min={0}
									value={maxLength ?? ""}
									onChange={(e) =>
										setMaxLength(
											e.target.value
												? Number.parseInt(e.target.value, 10)
												: undefined,
										)
									}
									onBlur={handleBlur}
									placeholder="No limit"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t bg-muted/30">
				<div className="flex items-center justify-between">
					<Badge variant="outline" className="text-xs">
						{isSaving ? "Saving..." : "Auto-saved"}
					</Badge>
					<Button variant="outline" size="sm" onClick={onClose}>
						Done
					</Button>
				</div>
			</div>
		</div>
	);
}
