import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format, parse } from "date-fns";
import {
  CalendarIcon,
  CreditCardIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { InputCurrency, parseCurrency } from "../ui/input-currency";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// --- Types ---

type PaymentType =
  | "one_time"
  | "recurring"
  | "installments"
  | "deposit_balance";
type DueDateTerms = "on_receipt" | "net_15" | "net_30" | "net_60" | "custom";
type PaymentMethodKey =
  | "card"
  | "ach_debit"
  | "apple_pay"
  | "google_pay"
  | "link";
type FeeHandling = "absorb" | "pass_to_recipient";
type RecurringInterval = "week" | "month" | "year";
type RecurringEndCondition = "never" | "after_count" | "on_date";
type InstallmentInterval = "week" | "month";
type LateFeeType = "percentage" | "fixed";
type TaxBehavior = "inclusive" | "exclusive";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
}

interface PaymentConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: Id<"signature_fields"> | null;
}

type PaymentFieldConfig = Doc<"payment_field_configs">;

type PaymentConfigDraft = {
  readonly items: LineItem[];
  readonly paymentType: PaymentType;
  readonly dueDateTerms: DueDateTerms;
  readonly customDueDays: number;
  readonly customDueDateMode: "days" | "date";
  readonly customDueDate: Date | undefined;
  readonly lateFeeEnabled: boolean;
  readonly lateFeeType: LateFeeType;
  readonly lateFeeAmount: number;
  readonly lateFeeGraceDays: number;
  readonly recurringInterval: RecurringInterval;
  readonly recurringIntervalCount: number;
  readonly recurringEndCondition: RecurringEndCondition;
  readonly recurringEndAfterCount: number;
  readonly installmentsCount: number;
  readonly installmentsInterval: InstallmentInterval;
  readonly depositPercent: number;
  readonly balanceDueDays: number;
  readonly paymentMethods: Record<PaymentMethodKey, boolean>;
  readonly feeHandling: FeeHandling;
  readonly taxEnabled: boolean;
  readonly taxBehavior: TaxBehavior;
};

type DraftFieldSetter = <K extends keyof PaymentConfigDraft>(
  field: K,
  value: PaymentConfigDraft[K]
) => void;

type PaymentConfigForm = {
  readonly draft: PaymentConfigDraft;
  readonly addItem: () => void;
  readonly removeItem: (id: string) => void;
  readonly setDraftField: DraftFieldSetter;
  readonly setPaymentMethod: (
    method: PaymentMethodKey,
    enabled: boolean
  ) => void;
  readonly updateItem: (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => void;
};

type UpsertPaymentConfig = (
  args: PaymentConfigMutationInput
) => Promise<unknown>;

type PaymentConfigMutationInput = {
  fieldId: Id<"signature_fields">;
  paymentType: PaymentType;
  items: LineItem[];
  currency: "usd";
  dueDateTerms: DueDateTerms;
  customDueDays?: number;
  customDueDate?: string;
  lateFees?: {
    enabled: true;
    type: LateFeeType;
    amount: number;
    gracePeriodDays: number;
  };
  recurringConfig?: {
    interval: RecurringInterval;
    intervalCount: number;
    endCondition: RecurringEndCondition;
    endAfterCount?: number;
  };
  installmentsConfig?: {
    count: number;
    interval: InstallmentInterval;
  };
  depositBalanceConfig?: {
    depositPercent: number;
    balanceDueDays: number;
  };
  allowedPaymentMethods: PaymentMethodKey[];
  feeHandling: FeeHandling;
  taxEnabled: boolean;
  taxBehavior?: TaxBehavior;
};

// --- Helpers ---

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function computeTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

// --- Component ---

export function PaymentConfigModal({
  open,
  onOpenChange,
  fieldId,
}: PaymentConfigModalProps) {
  const existingConfig = useQuery(
    api.payment_fields.queries.getPaymentConfigByField,
    fieldId ? { fieldId } : "skip"
  );
  const upsertConfig = useMutation(
    api.payment_fields.mutations.upsertPaymentConfig
  );
  const form = usePaymentConfigForm(existingConfig);
  const [isSaving, setIsSaving] = useState(false);
  const total = computeTotal(form.draft.items);

  const handleSave = async () => {
    await savePaymentConfig({
      draft: form.draft,
      fieldId,
      onOpenChange,
      setIsSaving,
      upsertConfig,
    });
  };

  if (fieldId && existingConfig === undefined) {
    return (
      <PaymentConfigLoadingDialog open={open} onOpenChange={onOpenChange} />
    );
  }

  return (
    <PaymentConfigDialog
      form={form}
      isSaving={isSaving}
      open={open}
      total={total}
      onOpenChange={onOpenChange}
      onSave={handleSave}
    />
  );
}

function usePaymentConfigForm(
  existingConfig: PaymentFieldConfig | null | undefined
): PaymentConfigForm {
  const [draft, setDraft] = useState(defaultPaymentConfigDraft);
  const resetToDefaults = useCallback(
    () => setDraft(defaultPaymentConfigDraft()),
    []
  );

  useEffect(() => {
    if (existingConfig)
      setDraft(paymentConfigDraftFromExisting(existingConfig));
    else if (existingConfig === null) resetToDefaults();
  }, [existingConfig, resetToDefaults]);

  const setDraftField: DraftFieldSetter = useCallback((field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setPaymentMethod = useCallback(
    (method: PaymentMethodKey, enabled: boolean) => {
      setDraft((prev) => ({
        ...prev,
        paymentMethods: { ...prev.paymentMethods, [method]: enabled },
      }));
    },
    []
  );

  const addItem = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      items: [...prev.items, defaultLineItem()],
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      items:
        prev.items.length <= 1
          ? prev.items
          : prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  const updateItem = useCallback(
    (id: string, field: keyof LineItem, value: string | number) => {
      setDraft((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      }));
    },
    []
  );

  return {
    draft,
    addItem,
    removeItem,
    setDraftField,
    setPaymentMethod,
    updateItem,
  };
}

function PaymentConfigLoadingDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentConfigDialog({
  form,
  isSaving,
  open,
  total,
  onOpenChange,
  onSave,
}: {
  readonly form: PaymentConfigForm;
  readonly isSaving: boolean;
  readonly open: boolean;
  readonly total: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <PaymentConfigHeader />
        <PaymentConfigTabs form={form} total={total} />
        <PaymentConfigFooter
          isSaving={isSaving}
          total={total}
          onCancel={() => onOpenChange(false)}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentConfigHeader() {
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <CreditCardIcon className="text-field-payment h-5 w-5" />
        Configure Payment
      </DialogTitle>
      <DialogDescription>
        Set up line items, payment terms, and accepted methods for this payment
        field.
      </DialogDescription>
    </DialogHeader>
  );
}

function PaymentConfigTabs({
  form,
  total,
}: {
  readonly form: PaymentConfigForm;
  readonly total: number;
}) {
  return (
    <Tabs defaultValue="items" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="items">Invoice Items</TabsTrigger>
        <TabsTrigger value="terms">Payment Terms</TabsTrigger>
        <TabsTrigger value="methods">Methods & Tax</TabsTrigger>
      </TabsList>
      <InvoiceItemsTab form={form} total={total} />
      <PaymentTermsTab
        draft={form.draft}
        setDraftField={form.setDraftField}
        total={total}
      />
      <MethodsAndTaxTab form={form} />
    </Tabs>
  );
}

function InvoiceItemsTab({
  form,
  total,
}: {
  readonly form: PaymentConfigForm;
  readonly total: number;
}) {
  return (
    <TabsContent value="items" className="space-y-4 pt-4">
      <div className="space-y-3">
        {form.draft.items.map((item) => (
          <InvoiceItemRow key={item.id} form={form} item={item} />
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={form.addItem}>
        <PlusIcon className="mr-1 h-4 w-4" />
        Add Item
      </Button>
      <div className="flex justify-between border-t pt-3">
        <span className="text-sm font-medium">Subtotal</span>
        <span className="text-sm font-bold">{formatCents(total)}</span>
      </div>
    </TabsContent>
  );
}

function InvoiceItemRow({
  form,
  item,
}: {
  readonly form: PaymentConfigForm;
  readonly item: LineItem;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(event) =>
            form.updateItem(item.id, "description", event.target.value)
          }
        />
      </div>
      <div className="w-20">
        <Input
          type="number"
          min={1}
          placeholder="Qty"
          value={item.quantity}
          onChange={(event) =>
            form.updateItem(
              item.id,
              "quantity",
              Math.max(1, Number(event.target.value))
            )
          }
        />
      </div>
      <div className="w-32">
        <InputCurrency
          value={item.unitPrice > 0 ? (item.unitPrice / 100).toFixed(2) : ""}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            form.updateItem(
              item.id,
              "unitPrice",
              Math.round(parseCurrency(event.target.value) * 100)
            );
          }}
          placeholder="$0.00"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label="Remove invoice item"
        onClick={() => form.removeItem(item.id)}
        disabled={form.draft.items.length <= 1}
      >
        <TrashIcon className="text-destructive h-4 w-4" />
      </Button>
    </div>
  );
}

function PaymentTermsTab({
  draft,
  setDraftField,
  total,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
  readonly total: number;
}) {
  return (
    <TabsContent value="terms" className="space-y-5 pt-4">
      <PaymentTypeSection draft={draft} setDraftField={setDraftField} />
      {draft.paymentType === "one_time" && (
        <DueDateSection draft={draft} setDraftField={setDraftField} />
      )}
      {draft.paymentType === "recurring" && (
        <RecurringScheduleSection draft={draft} setDraftField={setDraftField} />
      )}
      {draft.paymentType === "installments" && (
        <InstallmentPlanSection
          draft={draft}
          setDraftField={setDraftField}
          total={total}
        />
      )}
      {draft.paymentType === "deposit_balance" && (
        <DepositBalanceSection
          draft={draft}
          setDraftField={setDraftField}
          total={total}
        />
      )}
      <LateFeesSection draft={draft} setDraftField={setDraftField} />
      <FeeHandlingSection
        feeHandling={draft.feeHandling}
        setDraftField={setDraftField}
      />
    </TabsContent>
  );
}

function PaymentTypeSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>Payment Type</Label>
      <Select
        value={draft.paymentType}
        onValueChange={(value) =>
          setDraftField("paymentType", value as PaymentType)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one_time">One-time Payment</SelectItem>
          <SelectItem value="recurring">Recurring</SelectItem>
          <SelectItem value="installments">Installments</SelectItem>
          <SelectItem value="deposit_balance">Deposit + Balance</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function DueDateSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>Due Date</Label>
      <Select
        value={draft.dueDateTerms}
        onValueChange={(value) =>
          setDraftField("dueDateTerms", value as DueDateTerms)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="on_receipt">Due on receipt</SelectItem>
          <SelectItem value="net_15">Net 15</SelectItem>
          <SelectItem value="net_30">Net 30</SelectItem>
          <SelectItem value="net_60">Net 60</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      {draft.dueDateTerms === "custom" && (
        <CustomDueDateControls draft={draft} setDraftField={setDraftField} />
      )}
    </div>
  );
}

function CustomDueDateControls({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={draft.customDueDateMode === "days" ? "default" : "outline"}
          onClick={() => setDraftField("customDueDateMode", "days")}
        >
          Days from signing
        </Button>
        <Button
          type="button"
          size="sm"
          variant={draft.customDueDateMode === "date" ? "default" : "outline"}
          onClick={() => setDraftField("customDueDateMode", "date")}
        >
          Specific date
        </Button>
      </div>
      {draft.customDueDateMode === "days" ? (
        <CustomDueDaysInput draft={draft} setDraftField={setDraftField} />
      ) : (
        <CustomDueDatePicker draft={draft} setDraftField={setDraftField} />
      )}
    </div>
  );
}

function CustomDueDaysInput({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        className="w-24"
        value={draft.customDueDays}
        onChange={(event) =>
          setDraftField("customDueDays", Number(event.target.value))
        }
      />
      <span className="text-muted-foreground text-sm">days</span>
    </div>
  );
}

function CustomDueDatePicker({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {draft.customDueDate
            ? format(draft.customDueDate, "PPP")
            : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={draft.customDueDate}
          onSelect={(date) => setDraftField("customDueDate", date)}
        />
      </PopoverContent>
    </Popover>
  );
}

function RecurringScheduleSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <span className="text-sm font-medium">Recurring Schedule</span>
      <div className="flex items-center gap-2">
        <span className="text-sm">Every</span>
        <Input
          type="number"
          min={1}
          className="w-20"
          value={draft.recurringIntervalCount}
          onChange={(event) =>
            setDraftField(
              "recurringIntervalCount",
              Math.max(1, Number(event.target.value))
            )
          }
        />
        <Select
          value={draft.recurringInterval}
          onValueChange={(value) =>
            setDraftField("recurringInterval", value as RecurringInterval)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week(s)</SelectItem>
            <SelectItem value="month">Month(s)</SelectItem>
            <SelectItem value="year">Year(s)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RecurringEndConditionSection
        draft={draft}
        setDraftField={setDraftField}
      />
    </div>
  );
}

function RecurringEndConditionSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>End Condition</Label>
      <Select
        value={draft.recurringEndCondition}
        onValueChange={(value) =>
          setDraftField("recurringEndCondition", value as RecurringEndCondition)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="never">Never (until cancelled)</SelectItem>
          <SelectItem value="after_count">After # payments</SelectItem>
          <SelectItem value="on_date">On specific date</SelectItem>
        </SelectContent>
      </Select>
      {draft.recurringEndCondition === "after_count" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={draft.recurringEndAfterCount}
            onChange={(event) =>
              setDraftField(
                "recurringEndAfterCount",
                Math.max(1, Number(event.target.value))
              )
            }
          />
          <span className="text-muted-foreground text-sm">payments</span>
        </div>
      )}
    </div>
  );
}

function InstallmentPlanSection({
  draft,
  setDraftField,
  total,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
  readonly total: number;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <span className="text-sm font-medium">Installment Plan</span>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Number of Payments</Label>
          <Input
            type="number"
            min={2}
            value={draft.installmentsCount}
            onChange={(event) =>
              setDraftField(
                "installmentsCount",
                Math.max(2, Number(event.target.value))
              )
            }
          />
        </div>
        <InstallmentIntervalSelect
          draft={draft}
          setDraftField={setDraftField}
        />
      </div>
      {total > 0 && (
        <p className="text-muted-foreground text-sm">
          {draft.installmentsCount} payments of{" "}
          <span className="font-medium">
            {formatCents(Math.ceil(total / draft.installmentsCount))}
          </span>
        </p>
      )}
    </div>
  );
}

function InstallmentIntervalSelect({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>Interval</Label>
      <Select
        value={draft.installmentsInterval}
        onValueChange={(value) =>
          setDraftField("installmentsInterval", value as InstallmentInterval)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Weekly</SelectItem>
          <SelectItem value="month">Monthly</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function DepositBalanceSection({
  draft,
  setDraftField,
  total,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
  readonly total: number;
}) {
  const depositAmount = Math.round((total * draft.depositPercent) / 100);
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <span className="text-sm font-medium">Deposit & Balance</span>
      <div className="grid grid-cols-2 gap-4">
        <DepositPercentInput draft={draft} setDraftField={setDraftField} />
        <BalanceDueDaysInput draft={draft} setDraftField={setDraftField} />
      </div>
      {total > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <p>
            Deposit:{" "}
            <span className="font-medium">{formatCents(depositAmount)}</span> (
            {draft.depositPercent}%)
          </p>
          <p>
            Balance:{" "}
            <span className="font-medium">
              {formatCents(total - depositAmount)}
            </span>{" "}
            due in {draft.balanceDueDays} days
          </p>
        </div>
      )}
    </div>
  );
}

function DepositPercentInput({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>Deposit (%)</Label>
      <Input
        type="number"
        min={1}
        max={99}
        value={draft.depositPercent}
        onChange={(event) =>
          setDraftField(
            "depositPercent",
            Math.max(1, Math.min(99, Number(event.target.value)))
          )
        }
      />
    </div>
  );
}

function BalanceDueDaysInput({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label>Balance Due (days)</Label>
      <Input
        type="number"
        min={1}
        value={draft.balanceDueDays}
        onChange={(event) =>
          setDraftField(
            "balanceDueDays",
            Math.max(1, Number(event.target.value))
          )
        }
      />
    </div>
  );
}

function LateFeesSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Late Fees</Label>
          <p className="text-muted-foreground text-xs">
            Charge fees for overdue payments
          </p>
        </div>
        <Switch
          checked={draft.lateFeeEnabled}
          onCheckedChange={(checked) =>
            setDraftField("lateFeeEnabled", checked)
          }
        />
      </div>
      {draft.lateFeeEnabled && (
        <LateFeeInputs draft={draft} setDraftField={setDraftField} />
      )}
    </div>
  );
}

function LateFeeInputs({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select
          value={draft.lateFeeType}
          onValueChange={(value) =>
            setDraftField("lateFeeType", value as LateFeeType)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="fixed">Fixed Amount</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <LateFeeAmountInput draft={draft} setDraftField={setDraftField} />
      <div className="space-y-1">
        <Label className="text-xs">Grace (days)</Label>
        <Input
          type="number"
          min={0}
          value={draft.lateFeeGraceDays}
          onChange={(event) =>
            setDraftField("lateFeeGraceDays", Number(event.target.value))
          }
        />
      </div>
    </div>
  );
}

function LateFeeAmountInput({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {draft.lateFeeType === "percentage" ? "Rate (%)" : "Amount"}
      </Label>
      <Input
        type="number"
        min={0}
        step={draft.lateFeeType === "percentage" ? 0.5 : 1}
        value={draft.lateFeeAmount}
        onChange={(event) =>
          setDraftField("lateFeeAmount", Number(event.target.value))
        }
      />
    </div>
  );
}

function FeeHandlingSection({
  feeHandling,
  setDraftField,
}: {
  readonly feeHandling: FeeHandling;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2 border-t pt-4">
      <Label>Platform Fee Handling</Label>
      <Select
        value={feeHandling}
        onValueChange={(value) =>
          setDraftField("feeHandling", value as FeeHandling)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="absorb">Absorb (you pay Seal's fee)</SelectItem>
          <SelectItem value="pass_to_recipient">
            Pass to recipient (added to invoice)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function MethodsAndTaxTab({ form }: { readonly form: PaymentConfigForm }) {
  return (
    <TabsContent value="methods" className="space-y-5 pt-4">
      <PaymentMethodsSection form={form} />
      <TaxSection draft={form.draft} setDraftField={form.setDraftField} />
    </TabsContent>
  );
}

const paymentMethodOptions = [
  { key: "card", label: "Credit / Debit Card" },
  { key: "ach_debit", label: "ACH Direct Debit" },
  { key: "apple_pay", label: "Apple Pay (auto-enabled with Card)" },
  { key: "google_pay", label: "Google Pay (auto-enabled with Card)" },
  { key: "link", label: "Saved checkout profile" },
] as const satisfies readonly {
  readonly key: PaymentMethodKey;
  readonly label: string;
}[];

function PaymentMethodsSection({ form }: { readonly form: PaymentConfigForm }) {
  return (
    <div className="space-y-3">
      <Label>Accepted Payment Methods</Label>
      <div className="space-y-2">
        {paymentMethodOptions.map(({ key, label }) => (
          <label
            key={key}
            className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <Checkbox
              checked={form.draft.paymentMethods[key]}
              onCheckedChange={(checked) =>
                form.setPaymentMethod(key, !!checked)
              }
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TaxSection({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Tax</Label>
          <p className="text-muted-foreground text-xs">
            Enable automatic tax calculation through Vortex Payments
          </p>
        </div>
        <Switch
          checked={draft.taxEnabled}
          onCheckedChange={(checked) => setDraftField("taxEnabled", checked)}
        />
      </div>
      {draft.taxEnabled && (
        <TaxBehaviorSelect draft={draft} setDraftField={setDraftField} />
      )}
    </div>
  );
}

function TaxBehaviorSelect({
  draft,
  setDraftField,
}: {
  readonly draft: PaymentConfigDraft;
  readonly setDraftField: DraftFieldSetter;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Tax Behavior</Label>
      <Select
        value={draft.taxBehavior}
        onValueChange={(value) =>
          setDraftField("taxBehavior", value as TaxBehavior)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="exclusive">Exclusive (added on top)</SelectItem>
          <SelectItem value="inclusive">
            Inclusive (included in price)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PaymentConfigFooter({
  isSaving,
  total,
  onCancel,
  onSave,
}: {
  readonly isSaving: boolean;
  readonly total: number;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}) {
  return (
    <DialogFooter className="gap-2 border-t pt-4">
      <div className="flex flex-1 items-center gap-2">
        <Badge
          variant="outline"
          className="border-field-payment-border text-field-payment"
        >
          Total: {formatCents(total)}
        </Badge>
      </div>
      <Button variant="outline" onClick={onCancel} disabled={isSaving}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Payment Config"
        )}
      </Button>
    </DialogFooter>
  );
}

function defaultLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
  };
}

function defaultPaymentMethods(): Record<PaymentMethodKey, boolean> {
  return {
    card: true,
    ach_debit: false,
    apple_pay: false,
    google_pay: false,
    link: false,
  };
}

function defaultPaymentConfigDraft(): PaymentConfigDraft {
  return {
    items: [defaultLineItem()],
    paymentType: "one_time",
    dueDateTerms: "on_receipt",
    customDueDays: 30,
    customDueDateMode: "days",
    customDueDate: undefined,
    lateFeeEnabled: false,
    lateFeeType: "percentage",
    lateFeeAmount: 0,
    lateFeeGraceDays: 3,
    recurringInterval: "month",
    recurringIntervalCount: 1,
    recurringEndCondition: "never",
    recurringEndAfterCount: 12,
    installmentsCount: 3,
    installmentsInterval: "month",
    depositPercent: 50,
    balanceDueDays: 30,
    paymentMethods: defaultPaymentMethods(),
    feeHandling: "absorb",
    taxEnabled: false,
    taxBehavior: "exclusive",
  };
}

function paymentConfigDraftFromExisting(
  config: PaymentFieldConfig
): PaymentConfigDraft {
  const draft = defaultPaymentConfigDraft();
  return {
    ...draft,
    items: config.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    paymentType: config.paymentType,
    dueDateTerms: config.dueDateTerms,
    ...customDueDateDraft(config),
    ...lateFeeDraft(config),
    ...recurringDraft(config),
    ...installmentsDraft(config),
    ...depositBalanceDraft(config),
    paymentMethods: paymentMethodsFromExisting(config.allowedPaymentMethods),
    feeHandling: config.feeHandling,
    taxEnabled: config.taxEnabled,
    taxBehavior: config.taxBehavior ?? draft.taxBehavior,
  };
}

function customDueDateDraft(
  config: PaymentFieldConfig
): Partial<PaymentConfigDraft> {
  if (config.customDueDate) {
    return {
      customDueDateMode: "date",
      customDueDate: parse(config.customDueDate, "yyyy-MM-dd", new Date()),
    };
  }
  return config.customDueDays
    ? { customDueDateMode: "days", customDueDays: config.customDueDays }
    : {};
}

function lateFeeDraft(config: PaymentFieldConfig): Partial<PaymentConfigDraft> {
  if (!config.lateFees) return {};
  return {
    lateFeeEnabled: config.lateFees.enabled,
    lateFeeType: config.lateFees.type,
    lateFeeAmount: config.lateFees.amount,
    lateFeeGraceDays: config.lateFees.gracePeriodDays,
  };
}

function recurringDraft(
  config: PaymentFieldConfig
): Partial<PaymentConfigDraft> {
  if (!config.recurringConfig) return {};
  return {
    recurringInterval: config.recurringConfig.interval,
    recurringIntervalCount: config.recurringConfig.intervalCount,
    recurringEndCondition: config.recurringConfig.endCondition,
    recurringEndAfterCount: config.recurringConfig.endAfterCount ?? 12,
  };
}

function installmentsDraft(
  config: PaymentFieldConfig
): Partial<PaymentConfigDraft> {
  if (!config.installmentsConfig) return {};
  return {
    installmentsCount: config.installmentsConfig.count,
    installmentsInterval: config.installmentsConfig.interval,
  };
}

function depositBalanceDraft(
  config: PaymentFieldConfig
): Partial<PaymentConfigDraft> {
  if (!config.depositBalanceConfig) return {};
  return {
    depositPercent: config.depositBalanceConfig.depositPercent,
    balanceDueDays: config.depositBalanceConfig.balanceDueDays,
  };
}

function paymentMethodsFromExisting(
  allowedPaymentMethods: readonly string[]
): Record<PaymentMethodKey, boolean> {
  const methods = defaultPaymentMethods();
  for (const method of allowedPaymentMethods) {
    if (isPaymentMethodKey(method)) methods[method] = true;
  }
  return methods;
}

function isPaymentMethodKey(value: string): value is PaymentMethodKey {
  return value in defaultPaymentMethods();
}

async function savePaymentConfig(input: {
  readonly draft: PaymentConfigDraft;
  readonly fieldId: Id<"signature_fields"> | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly setIsSaving: (isSaving: boolean) => void;
  readonly upsertConfig: UpsertPaymentConfig;
}) {
  const validationError = validatePaymentConfigDraft(
    input.draft,
    input.fieldId
  );
  if (validationError) {
    toast.error(validationError);
    return;
  }

  input.setIsSaving(true);
  try {
    await input.upsertConfig(
      buildPaymentConfigMutationInput(input.draft, input.fieldId)
    );
    toast.success("Payment configuration saved");
    input.onOpenChange(false);
  } catch (error) {
    toast.error("Failed to save payment configuration", {
      description: getErrorMessage(error),
    });
  } finally {
    input.setIsSaving(false);
  }
}

function validatePaymentConfigDraft(
  draft: PaymentConfigDraft,
  fieldId: Id<"signature_fields"> | null
): string | null {
  if (!fieldId) return "Payment field is missing";
  if (draft.items.some((item) => !item.description.trim())) {
    return "Each line item must have a description";
  }
  if (computeTotal(draft.items) < 50)
    return "Total amount must be at least $0.50";
  if (selectedPaymentMethods(draft).length === 0)
    return "At least one payment method must be selected";
  return null;
}

function buildPaymentConfigMutationInput(
  draft: PaymentConfigDraft,
  fieldId: Id<"signature_fields"> | null
): PaymentConfigMutationInput {
  if (!fieldId) throw new Error("Payment field is missing");
  return {
    fieldId,
    paymentType: draft.paymentType,
    items: draft.items.map(({ id, description, quantity, unitPrice }) => ({
      id,
      description,
      quantity,
      unitPrice,
    })),
    currency: "usd",
    dueDateTerms: draft.dueDateTerms,
    customDueDays: customDueDaysForMutation(draft),
    customDueDate: customDueDateForMutation(draft),
    lateFees: lateFeesForMutation(draft),
    recurringConfig: recurringConfigForMutation(draft),
    installmentsConfig: installmentsConfigForMutation(draft),
    depositBalanceConfig: depositBalanceConfigForMutation(draft),
    allowedPaymentMethods: selectedPaymentMethods(draft),
    feeHandling: draft.feeHandling,
    taxEnabled: draft.taxEnabled,
    taxBehavior: draft.taxEnabled ? draft.taxBehavior : undefined,
  };
}

function selectedPaymentMethods(draft: PaymentConfigDraft): PaymentMethodKey[] {
  return paymentMethodOptions
    .filter(({ key }) => draft.paymentMethods[key])
    .map(({ key }) => key);
}

function customDueDaysForMutation(
  draft: PaymentConfigDraft
): number | undefined {
  return draft.dueDateTerms === "custom" && draft.customDueDateMode === "days"
    ? draft.customDueDays
    : undefined;
}

function customDueDateForMutation(
  draft: PaymentConfigDraft
): string | undefined {
  return draft.dueDateTerms === "custom" &&
    draft.customDueDateMode === "date" &&
    draft.customDueDate
    ? format(draft.customDueDate, "yyyy-MM-dd")
    : undefined;
}

function lateFeesForMutation(
  draft: PaymentConfigDraft
): PaymentConfigMutationInput["lateFees"] {
  return draft.lateFeeEnabled
    ? {
        enabled: true,
        type: draft.lateFeeType,
        amount: draft.lateFeeAmount,
        gracePeriodDays: draft.lateFeeGraceDays,
      }
    : undefined;
}

function recurringConfigForMutation(
  draft: PaymentConfigDraft
): PaymentConfigMutationInput["recurringConfig"] {
  return draft.paymentType === "recurring"
    ? {
        interval: draft.recurringInterval,
        intervalCount: draft.recurringIntervalCount,
        endCondition: draft.recurringEndCondition,
        endAfterCount:
          draft.recurringEndCondition === "after_count"
            ? draft.recurringEndAfterCount
            : undefined,
      }
    : undefined;
}

function installmentsConfigForMutation(
  draft: PaymentConfigDraft
): PaymentConfigMutationInput["installmentsConfig"] {
  return draft.paymentType === "installments"
    ? { count: draft.installmentsCount, interval: draft.installmentsInterval }
    : undefined;
}

function depositBalanceConfigForMutation(
  draft: PaymentConfigDraft
): PaymentConfigMutationInput["depositBalanceConfig"] {
  return draft.paymentType === "deposit_balance"
    ? {
        depositPercent: draft.depositPercent,
        balanceDueDays: draft.balanceDueDays,
      }
    : undefined;
}
