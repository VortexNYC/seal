import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  GripVerticalIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
  const [options, setOptions] = useState<FieldOption[]>(initialConfig?.options || []);
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
  const defaultOptionToggleId = useId();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setOptions(initialConfig?.options || []);
      setAllowMultiple(initialConfig?.allowMultiple ?? fieldType === "checkbox");
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
        opt.id === id ? { ...opt, label, value: label.toLowerCase().replace(/\s+/g, "_") } : opt,
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
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
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
        {/* vortex-allow-color: modal/dialog scrim needs fixed black opacity for backdrop contrast. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-card border-border fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border shadow-2xl">
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <DialogPrimitive.Title className="text-foreground mb-1 text-base font-semibold tracking-tight">
              {config.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground text-sm">
              {config.description}
            </DialogPrimitive.Description>
            <DialogPrimitive.Close className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-md transition-colors">
              <XIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="max-h-[50vh] overflow-y-auto px-5 pb-5">
            <div>
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                Options
              </div>

              {options.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground max-w-[220px] text-sm">{config.emptyText}</p>
                </div>
              ) : (
                <div className="bg-muted flex flex-col gap-0.5 rounded-lg p-0.5">
                  {options.map((option, index) => (
                    <div
                      key={option.id}
                      className={cn(
                        "group bg-card flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors",
                        draggedIndex === index && "opacity-50",
                        dragOverIndex === index && "bg-muted",
                      )}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="text-muted-foreground flex h-4 w-4 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVerticalIcon className="h-3.5 w-3.5" />
                      </div>
                      <input
                        ref={index === options.length - 1 ? newInputRef : null}
                        type="text"
                        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 border-none bg-transparent py-1 text-sm focus:outline-none"
                        value={option.label}
                        onChange={(e) => handleOptionChange(option.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        placeholder="Enter option label..."
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handleDeleteOption(option.id)}
                        title="Remove option"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="border-border text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground mt-2 flex w-full items-center justify-start gap-1.5 rounded-lg border border-dashed bg-transparent px-3 py-2.5 text-sm font-medium transition-colors"
                onClick={handleAddOption}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add Option
              </button>
            </div>

            {/* Default option toggle - only for dropdown and radio */}
            {fieldType !== "checkbox" && options.length > 0 && (
              <div className="border-border mt-4 border-t pt-4">
                <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                  Default Selection
                </div>
                <div className="flex items-start gap-2.5">
                  <input
                    id={defaultOptionToggleId}
                    type="checkbox"
                    checked={!!defaultOptionId}
                    onChange={(e) => {
                      if (e.target.checked && options[0]) {
                        setDefaultOptionId(options[0].id);
                      } else {
                        setDefaultOptionId(undefined);
                      }
                    }}
                    className="border-border text-foreground mt-0.5 h-4 w-4 rounded focus:ring-offset-0"
                  />
                  <label htmlFor={defaultOptionToggleId} className="flex-1 cursor-pointer">
                    <div className="text-foreground text-sm font-medium">
                      Pre-select first option
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      Recipients will see this option already selected
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-card border-border flex items-center justify-end gap-2 border-t px-5 py-4">
            <button
              type="button"
              className="border-border text-foreground hover:bg-muted rounded-md border bg-transparent px-3.5 py-2 text-sm font-medium transition-colors"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
