import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
	CheckSquareIcon,
	ChevronDownIcon,
	CircleDotIcon,
	GripVerticalIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Option item for multi-choice fields
 */
export interface FieldOption {
	id: string;
	label: string;
	value: string;
}

/**
 * Field configuration data returned from the dialog
 */
export interface FieldOptionsConfig {
	options: FieldOption[];
	allowMultiple: boolean;
	defaultOptionId?: string;
}

interface FieldOptionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	fieldType: "checkbox" | "dropdown" | "radio";
	onConfirm: (config: FieldOptionsConfig) => void;
	initialConfig?: FieldOptionsConfig;
}

/**
 * Field type display configuration
 */
const FIELD_TYPE_CONFIG: Record<
	"checkbox" | "dropdown" | "radio",
	{
		title: string;
		description: string;
		icon: React.ReactNode;
		emptyText: string;
	}
> = {
	checkbox: {
		title: "Checkbox options",
		description: "Recipients can select multiple options.",
		icon: <CheckSquareIcon />,
		emptyText: "Add the options recipients can choose from.",
	},
	dropdown: {
		title: "Dropdown options",
		description: "Recipients will select one option from the list.",
		icon: <ChevronDownIcon />,
		emptyText: "Add the options recipients can choose from.",
	},
	radio: {
		title: "Radio options",
		description: "Recipients will select exactly one option.",
		icon: <CircleDotIcon />,
		emptyText: "Add the options recipients can choose from.",
	},
};

/**
 * Generate a unique ID for options
 */
function generateOptionId(): string {
	return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * FieldOptionsDialog - Minimal Form Builder
 *
 * A dialog for configuring multi-choice field options.
 * Supports checkbox groups, dropdown menus, and radio buttons.
 */
export function FieldOptionsDialog({
	open,
	onOpenChange,
	fieldType,
	onConfirm,
	initialConfig,
}: FieldOptionsDialogProps) {
	const config = FIELD_TYPE_CONFIG[fieldType];

	// Options state
	const [options, setOptions] = useState<FieldOption[]>(
		initialConfig?.options || [],
	);
	const [allowMultiple, setAllowMultiple] = useState(
		initialConfig?.allowMultiple ?? fieldType === "checkbox",
	);
	const [defaultOptionId, setDefaultOptionId] = useState<string | undefined>(
		initialConfig?.defaultOptionId,
	);

	// Drag state
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// Ref for focusing new inputs
	const newInputRef = useRef<HTMLInputElement | null>(null);

	// Reset state when dialog opens
	useEffect(() => {
		if (open) {
			setOptions(initialConfig?.options || []);
			setAllowMultiple(
				initialConfig?.allowMultiple ?? fieldType === "checkbox",
			);
			setDefaultOptionId(initialConfig?.defaultOptionId);
		}
	}, [open, initialConfig, fieldType]);

	// Add a new option
	const handleAddOption = useCallback(() => {
		const newOption: FieldOption = {
			id: generateOptionId(),
			label: "",
			value: "",
		};
		setOptions((prev) => [...prev, newOption]);
		// Focus the new input after render
		requestAnimationFrame(() => {
			newInputRef.current?.focus();
		});
	}, []);

	// Update option label
	const handleOptionChange = useCallback((id: string, label: string) => {
		setOptions((prev) =>
			prev.map((opt) =>
				opt.id === id
					? { ...opt, label, value: label.toLowerCase().replace(/\s+/g, "_") }
					: opt,
			),
		);
	}, []);

	// Delete option
	const handleDeleteOption = useCallback(
		(id: string) => {
			setOptions((prev) => prev.filter((opt) => opt.id !== id));
			if (defaultOptionId === id) {
				setDefaultOptionId(undefined);
			}
		},
		[defaultOptionId],
	);

	// Drag handlers
	const handleDragStart = useCallback((index: number) => {
		setDraggedIndex(index);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, index: number) => {
			e.preventDefault();
			if (draggedIndex !== null && draggedIndex !== index) {
				setDragOverIndex(index);
			}
		},
		[draggedIndex],
	);

	const handleDragEnd = useCallback(() => {
		if (
			draggedIndex !== null &&
			dragOverIndex !== null &&
			draggedIndex !== dragOverIndex
		) {
			setOptions((prev) => {
				const newOptions = [...prev];
				const [removed] = newOptions.splice(draggedIndex, 1);
				newOptions.splice(dragOverIndex, 0, removed);
				return newOptions;
			});
		}
		setDraggedIndex(null);
		setDragOverIndex(null);
	}, [draggedIndex, dragOverIndex]);

	// Handle keyboard in options
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAddOption();
			} else if (e.key === "Backspace" && options[index]?.label === "") {
				e.preventDefault();
				if (options.length > 1) {
					handleDeleteOption(options[index].id);
				}
			}
		},
		[options, handleAddOption, handleDeleteOption],
	);

	// Confirm handler
	const handleConfirm = useCallback(() => {
		// Filter out empty options
		const validOptions = options.filter((opt) => opt.label.trim() !== "");

		onConfirm({
			options: validOptions,
			allowMultiple: fieldType === "checkbox" ? allowMultiple : false,
			defaultOptionId: validOptions.some((o) => o.id === defaultOptionId)
				? defaultOptionId
				: undefined,
		});
	}, [options, allowMultiple, defaultOptionId, fieldType, onConfirm]);

	// Check if can confirm (at least one valid option)
	const canConfirm = options.some((opt) => opt.label.trim() !== "");

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
				<DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[420px] bg-white border border-gray-200 rounded-xl shadow-[0_16px_70px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
					{/* Header */}
					<div className="relative px-5 pt-5 pb-4">
						<DialogPrimitive.Title className="text-base font-semibold text-gray-900 tracking-tight mb-1">
							{config.title}
						</DialogPrimitive.Title>
						<DialogPrimitive.Description className="text-sm text-gray-500">
							{config.description}
						</DialogPrimitive.Description>
						<DialogPrimitive.Close className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
							<XIcon className="w-4 h-4" />
						</DialogPrimitive.Close>
					</div>

					{/* Body */}
					<div className="px-5 pb-5 max-h-[50vh] overflow-y-auto">
						<div>
							<div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">
								Options
							</div>

							{options.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<p className="text-sm text-gray-400 max-w-[220px]">
										{config.emptyText}
									</p>
								</div>
							) : (
								<div className="flex flex-col gap-0.5 bg-gray-50 rounded-lg p-0.5">
									{options.map((option, index) => (
										<div
											key={option.id}
											className={`group flex items-center gap-2 px-2.5 py-2 bg-white rounded-md transition-colors ${
												draggedIndex === index ? "opacity-50" : ""
											} ${dragOverIndex === index ? "bg-gray-100" : ""}`}
											draggable
											onDragStart={() => handleDragStart(index)}
											onDragOver={(e) => handleDragOver(e, index)}
											onDragEnd={handleDragEnd}
										>
											<div className="flex items-center justify-center w-4 h-4 text-gray-400 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
												<GripVerticalIcon className="w-3.5 h-3.5" />
											</div>
											<input
												ref={index === options.length - 1 ? newInputRef : null}
												type="text"
												className="flex-1 min-w-0 py-1 bg-transparent border-none text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
												value={option.label}
												onChange={(e) =>
													handleOptionChange(option.id, e.target.value)
												}
												onKeyDown={(e) => handleKeyDown(e, index)}
												placeholder="Enter option label..."
												autoComplete="off"
											/>
											<button
												type="button"
												className="flex items-center justify-center w-6 h-6 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
												onClick={() => handleDeleteOption(option.id)}
												title="Remove option"
											>
												<XIcon className="w-3.5 h-3.5" />
											</button>
										</div>
									))}
								</div>
							)}

							<button
								type="button"
								className="flex items-center justify-start gap-1.5 w-full px-3 py-2.5 mt-2 bg-transparent border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
								onClick={handleAddOption}
							>
								<PlusIcon className="w-3.5 h-3.5" />
								Add Option
							</button>
						</div>

						{/* Default option toggle - only for dropdown and radio */}
						{fieldType !== "checkbox" && options.length > 0 && (
							<div className="mt-4 pt-4 border-t border-gray-200">
								<div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">
									Default Selection
								</div>
								<label className="flex items-start gap-2.5 cursor-pointer">
									<input
										type="checkbox"
										checked={!!defaultOptionId}
										onChange={(e) => {
											if (e.target.checked && options[0]) {
												setDefaultOptionId(options[0].id);
											} else {
												setDefaultOptionId(undefined);
											}
										}}
										className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-offset-0"
									/>
									<div className="flex-1">
										<div className="text-sm font-medium text-gray-900">
											Pre-select first option
										</div>
										<div className="text-xs text-gray-400 mt-0.5">
											Recipients will see this option already selected
										</div>
									</div>
								</label>
							</div>
						)}
					</div>

					{/* Footer */}
					<div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-white">
						<button
							type="button"
							className="px-3.5 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="px-3.5 py-2 bg-gray-900 border border-gray-900 rounded-md text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							onClick={handleConfirm}
							disabled={!canConfirm}
						>
							Save
						</button>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
