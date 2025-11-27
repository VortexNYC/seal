import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TextFieldInputProps {
	label: string;
	value?: string;
	isRequired: boolean;
	placeholder?: string;
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	helpText?: string;
	onChange: (value: string) => void;
	onValidationChange: (isValid: boolean, error?: string) => void;
}

export function TextFieldInput({
	label,
	value = "",
	isRequired,
	placeholder,
	maxLength,
	minLength,
	pattern,
	helpText,
	onChange,
	onValidationChange,
}: TextFieldInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const [error, setError] = useState<string | undefined>();

	const validateValue = (val: string): { isValid: boolean; error?: string } => {
		if (isRequired && !val.trim()) {
			return { isValid: false, error: "This field is required" };
		}

		if (minLength && val.length < minLength) {
			return {
				isValid: false,
				error: `Minimum length is ${minLength} characters`,
			};
		}

		if (maxLength && val.length > maxLength) {
			return {
				isValid: false,
				error: `Maximum length is ${maxLength} characters`,
			};
		}

		if (pattern && val) {
			const regex = new RegExp(pattern);
			if (!regex.test(val)) {
				return {
					isValid: false,
					error: "Value does not match required format",
				};
			}
		}

		return { isValid: true };
	};

	const handleChange = (val: string) => {
		setLocalValue(val);
		onChange(val);

		const validation = validateValue(val);
		setError(validation.error);
		onValidationChange(validation.isValid, validation.error);
	};

	// Determine if we should use textarea based on max length or if it's a long field
	const useTextarea = maxLength ? maxLength > 100 : false;

	return (
		<div className="space-y-2">
			<Label htmlFor="text-field">
				{label}
				{isRequired && <span className="text-destructive ml-1">*</span>}
			</Label>
			{useTextarea ? (
				<Textarea
					id="text-field"
					value={localValue}
					onChange={(e) => handleChange(e.target.value)}
					placeholder={placeholder}
					maxLength={maxLength}
					rows={4}
					className={error ? "border-destructive" : ""}
				/>
			) : (
				<Input
					id="text-field"
					value={localValue}
					onChange={(e) => handleChange(e.target.value)}
					placeholder={placeholder}
					maxLength={maxLength}
					className={error ? "border-destructive" : ""}
				/>
			)}
			{helpText && !error && (
				<p className="text-xs text-muted-foreground">{helpText}</p>
			)}
			{error && <p className="text-xs text-destructive">{error}</p>}
			{maxLength && (
				<p className="text-xs text-muted-foreground text-right">
					{localValue.length} / {maxLength}
				</p>
			)}
		</div>
	);
}
