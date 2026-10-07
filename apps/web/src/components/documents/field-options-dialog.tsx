import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { CaretDown as ChevronDownIcon, CheckSquare as CheckSquareIcon, RadioButton as CircleDotIcon, DotsSixVertical as GripVerticalIcon, Plus as PlusIcon, X as XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { RailBack } from "./rail-back";

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
  fieldType: "checkbox" | "dropdown" | "radio" | "multi_select";
  onConfirm: (config: FieldOptionsConfig) => void;
  initialConfig?: FieldOptionsConfig;
  presentation?: "dialog" | "panel";
}

/**
 * Field type display configuration
 */
const FIELD_TYPE_CONFIG: Record<
  "checkbox" | "dropdown" | "radio" | "multi_select",
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
  multi_select: {
    title: "Multi-select options",
    description: "Recipients can select multiple options.",
    icon: <CheckSquareIcon />,
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
  presentation = "dialog",
}: FieldOptionsDialogProps) {
  const config = FIELD_TYPE_CONFIG[fieldType];

  // Options state
  const [options, setOptions] = useState<FieldOption[]>(
    initialConfig?.options || []
  );
  const [allowMultiple, setAllowMultiple] = useState(
    initialConfig?.allowMultiple ??
      (fieldType === "checkbox" || fieldType === "multi_select")
  );
  const [defaultOptionId, setDefaultOptionId] = useState<string | undefined>(
    initialConfig?.defaultOptionId
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
        initialConfig?.allowMultiple ??
          (fieldType === "checkbox" || fieldType === "multi_select")
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
          : opt
      )
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
    [defaultOptionId]
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
    [draggedIndex]
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
    [options, handleAddOption, handleDeleteOption]
  );

  // Confirm handler
  const handleConfirm = useCallback(() => {
    // Filter out empty options
    const validOptions = options.filter((opt) => opt.label.trim() !== "");

    onConfirm({
      options: validOptions,
      allowMultiple:
        fieldType === "checkbox" || fieldType === "multi_select"
          ? allowMultiple
          : false,
      defaultOptionId: validOptions.some((o) => o.id === defaultOptionId)
        ? defaultOptionId
        : undefined,
    });
  }, [options, allowMultiple, defaultOptionId, fieldType, onConfirm]);

  // Check if can confirm (at least one valid option)
  const canConfirm = options.some((opt) => opt.label.trim() !== "");

  const optionsBody = (
    <>
          <div className="relative px-5 pt-5 pb-4">
            <Text as="p" size="sm" bold>
              {config.title}
            </Text>
            <Text as="p" variant="secondary" size="xs">
              {config.description}
            </Text>
            <Button
              type="button"
              variant="ghost"
              shape="square"
              size="sm"
              icon={XIcon}
              aria-label="Close"
              className="absolute top-4 right-4"
              onClick={() => onOpenChange(false)}
            />
          </div>

          {/* Body */}
          <div className="max-h-vh-50 overflow-y-auto px-5 pb-5">
            <div>
              <div className="text-kumo-secondary text-xs mb-2 flex items-center gap-1.5 font-medium tracking-wide uppercase">
                Options
              </div>

              {options.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Text as="p" variant="secondary" size="sm" DANGEROUS_className="max-w-55">{config.emptyText}</Text>
                </div>
              ) : (
                <div className="bg-kumo-elevated flex flex-col gap-0.5 rounded-lg p-0.5">
                  {options.map((option, index) => (
                    <div
                      key={option.id}
                      className={cn(
                        "group bg-kumo-base flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors",
                        draggedIndex === index && "opacity-50",
                        dragOverIndex === index && "bg-kumo-elevated"
                      )}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="text-kumo-secondary flex h-4 w-4 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVerticalIcon className="h-3.5 w-3.5" />
                      </div>
                      <Input
                        ref={index === options.length - 1 ? newInputRef : null}
                        value={option.label}
                        onChange={(e) =>
                          handleOptionChange(option.id, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        placeholder="Enter option label..."
                        aria-label={`Option ${index + 1}`}
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        shape="square"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100"
                        icon={XIcon}
                        onClick={() => handleDeleteOption(option.id)}
                        title="Remove option"
                        aria-label="Remove option"
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 w-full justify-start"
                icon={PlusIcon}
                onClick={handleAddOption}
              >
                Add Option
              </Button>
            </div>

            {/* Default option toggle - only for dropdown and radio */}
            {fieldType !== "checkbox" &&
              fieldType !== "multi_select" &&
              options.length > 0 && (
                <div className="border-kumo-line mt-4 border-t pt-4">
                  <div className="text-kumo-secondary text-xs mb-2 flex items-center gap-1.5 font-medium tracking-wide uppercase">
                    Default Selection
                  </div>
                  <Checkbox
                    checked={!!defaultOptionId}
                    onCheckedChange={(checked) => {
                      if (checked && options[0]) {
                        setDefaultOptionId(options[0].id);
                      } else {
                        setDefaultOptionId(undefined);
                      }
                    }}
                    label="Pre-select first option"
                  />
                </div>
              )}
          </div>

          {/* Footer */}
          <div className="bg-kumo-base border-kumo-line flex items-center justify-end gap-2 border-t px-5 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              Save
            </Button>
          </div>
    </>
  );

  if (presentation === "panel") {
    if (!open) return null;
    return (
      <div data-testid="field-options-panel" className="flex flex-col gap-2">
        <RailBack onBack={() => onOpenChange(false)} tip="Back to the fields" />
        {optionsBody}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="overflow-hidden p-0">
        <Dialog.Title className="sr-only">{config.title}</Dialog.Title>
        {optionsBody}
      </Dialog>
    </Dialog.Root>
  );
}
