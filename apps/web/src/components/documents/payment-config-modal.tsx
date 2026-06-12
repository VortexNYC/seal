import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format, parse } from "date-fns";
import { CalendarIcon, CreditCardIcon, Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// --- Types ---

type PaymentType = "one_time" | "recurring" | "installments" | "deposit_balance";
type DueDateTerms = "on_receipt" | "net_15" | "net_30" | "net_60" | "custom";
type PaymentMethodKey = "card" | "ach_debit" | "apple_pay" | "google_pay" | "link";
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

export function PaymentConfigModal({ open, onOpenChange, fieldId }: PaymentConfigModalProps) {
  const existingConfig = useQuery(
    api.payment_fields.queries.getPaymentConfigByField,
    fieldId ? { fieldId } : "skip",
  );
  const upsertConfig = useMutation(api.payment_fields.mutations.upsertPaymentConfig);

  // --- State ---
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [paymentType, setPaymentType] = useState<PaymentType>("one_time");
  const [dueDateTerms, setDueDateTerms] = useState<DueDateTerms>("on_receipt");
  const [customDueDays, setCustomDueDays] = useState<number>(30);
  const [customDueDateMode, setCustomDueDateMode] = useState<"days" | "date">("days");
  const [customDueDate, setCustomDueDate] = useState<Date | undefined>(undefined);

  // Late fees
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeType, setLateFeeType] = useState<LateFeeType>("percentage");
  const [lateFeeAmount, setLateFeeAmount] = useState<number>(0);
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState<number>(3);

  // Recurring config
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval>("month");
  const [recurringIntervalCount, setRecurringIntervalCount] = useState<number>(1);
  const [recurringEndCondition, setRecurringEndCondition] =
    useState<RecurringEndCondition>("never");
  const [recurringEndAfterCount, setRecurringEndAfterCount] = useState<number>(12);

  // Installments config
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [installmentsInterval, setInstallmentsInterval] = useState<InstallmentInterval>("month");

  // Deposit/balance config
  const [depositPercent, setDepositPercent] = useState<number>(50);
  const [balanceDueDays, setBalanceDueDays] = useState<number>(30);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<Record<PaymentMethodKey, boolean>>({
    card: true,
    ach_debit: false,
    apple_pay: false,
    google_pay: false,
    link: false,
  });

  // Fee handling
  const [feeHandling, setFeeHandling] = useState<FeeHandling>("absorb");

  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxBehavior, setTaxBehavior] = useState<TaxBehavior>("exclusive");

  const [isSaving, setIsSaving] = useState(false);

  // --- Reset state to defaults ---
  const resetToDefaults = useCallback(() => {
    setItems([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }]);
    setPaymentType("one_time");
    setDueDateTerms("on_receipt");
    setCustomDueDays(30);
    setCustomDueDateMode("days");
    setCustomDueDate(undefined);
    setLateFeeEnabled(false);
    setLateFeeType("percentage");
    setLateFeeAmount(0);
    setLateFeeGraceDays(3);
    setRecurringInterval("month");
    setRecurringIntervalCount(1);
    setRecurringEndCondition("never");
    setRecurringEndAfterCount(12);
    setInstallmentsCount(3);
    setInstallmentsInterval("month");
    setDepositPercent(50);
    setBalanceDueDays(30);
    setPaymentMethods({
      card: true,
      ach_debit: false,
      apple_pay: false,
      google_pay: false,
      link: false,
    });
    setFeeHandling("absorb");
    setTaxEnabled(false);
    setTaxBehavior("exclusive");
  }, []);

  // --- Load existing config or reset for new field ---
  useEffect(() => {
    if (existingConfig) {
      setItems(
        existingConfig.items.map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      );
      setPaymentType(existingConfig.paymentType);
      setDueDateTerms(existingConfig.dueDateTerms);
      if (existingConfig.customDueDate) {
        setCustomDueDateMode("date");
        setCustomDueDate(parse(existingConfig.customDueDate, "yyyy-MM-dd", new Date()));
      } else if (existingConfig.customDueDays) {
        setCustomDueDateMode("days");
        setCustomDueDays(existingConfig.customDueDays);
      }

      if (existingConfig.lateFees) {
        setLateFeeEnabled(existingConfig.lateFees.enabled);
        setLateFeeType(existingConfig.lateFees.type);
        setLateFeeAmount(existingConfig.lateFees.amount);
        setLateFeeGraceDays(existingConfig.lateFees.gracePeriodDays);
      }

      if (existingConfig.recurringConfig) {
        setRecurringInterval(existingConfig.recurringConfig.interval);
        setRecurringIntervalCount(existingConfig.recurringConfig.intervalCount);
        setRecurringEndCondition(existingConfig.recurringConfig.endCondition);
        if (existingConfig.recurringConfig.endAfterCount) {
          setRecurringEndAfterCount(existingConfig.recurringConfig.endAfterCount);
        }
      }

      if (existingConfig.installmentsConfig) {
        setInstallmentsCount(existingConfig.installmentsConfig.count);
        setInstallmentsInterval(existingConfig.installmentsConfig.interval);
      }

      if (existingConfig.depositBalanceConfig) {
        setDepositPercent(existingConfig.depositBalanceConfig.depositPercent);
        setBalanceDueDays(existingConfig.depositBalanceConfig.balanceDueDays);
      }

      const methods: Record<PaymentMethodKey, boolean> = {
        card: false,
        ach_debit: false,
        apple_pay: false,
        google_pay: false,
        link: false,
      };
      for (const m of existingConfig.allowedPaymentMethods) {
        if (m in methods) methods[m as PaymentMethodKey] = true;
      }
      setPaymentMethods(methods);

      setFeeHandling(existingConfig.feeHandling);
      setTaxEnabled(existingConfig.taxEnabled);
      if (existingConfig.taxBehavior) setTaxBehavior(existingConfig.taxBehavior);
    } else if (existingConfig === null) {
      resetToDefaults();
    }
  }, [existingConfig, resetToDefaults]);

  // --- Item handlers ---
  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.id !== id)));
  }, []);

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }, []);

  // --- Save ---
  const handleSave = async () => {
    if (!fieldId) return;

    // Basic client-side validation
    const hasEmptyDescriptions = items.some((i) => !i.description.trim());
    if (hasEmptyDescriptions) {
      toast.error("Each line item must have a description");
      return;
    }

    const total = computeTotal(items);
    if (total < 50) {
      toast.error("Total amount must be at least $0.50");
      return;
    }

    const selectedMethods = Object.entries(paymentMethods)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key as PaymentMethodKey);

    if (selectedMethods.length === 0) {
      toast.error("At least one payment method must be selected");
      return;
    }

    setIsSaving(true);
    try {
      await upsertConfig({
        fieldId,
        paymentType,
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        currency: "usd",
        dueDateTerms,
        customDueDays:
          dueDateTerms === "custom" && customDueDateMode === "days" ? customDueDays : undefined,
        customDueDate:
          dueDateTerms === "custom" && customDueDateMode === "date" && customDueDate
            ? format(customDueDate, "yyyy-MM-dd")
            : undefined,
        lateFees: lateFeeEnabled
          ? {
              enabled: true,
              type: lateFeeType,
              amount: lateFeeAmount,
              gracePeriodDays: lateFeeGraceDays,
            }
          : undefined,
        recurringConfig:
          paymentType === "recurring"
            ? {
                interval: recurringInterval,
                intervalCount: recurringIntervalCount,
                endCondition: recurringEndCondition,
                endAfterCount:
                  recurringEndCondition === "after_count" ? recurringEndAfterCount : undefined,
              }
            : undefined,
        installmentsConfig:
          paymentType === "installments"
            ? {
                count: installmentsCount,
                interval: installmentsInterval,
              }
            : undefined,
        depositBalanceConfig:
          paymentType === "deposit_balance"
            ? {
                depositPercent,
                balanceDueDays,
              }
            : undefined,
        allowedPaymentMethods: selectedMethods,
        feeHandling,
        taxEnabled,
        taxBehavior: taxEnabled ? taxBehavior : undefined,
      });

      toast.success("Payment configuration saved");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save payment configuration", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const total = computeTotal(items);

  if (fieldId && existingConfig === undefined) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="text-field-payment h-5 w-5" />
            Configure Payment
          </DialogTitle>
          <DialogDescription>
            Set up line items, payment terms, and accepted methods for this payment field.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">Invoice Items</TabsTrigger>
            <TabsTrigger value="terms">Payment Terms</TabsTrigger>
            <TabsTrigger value="methods">Methods & Tax</TabsTrigger>
          </TabsList>

          {/* ===== Tab 1: Invoice Items ===== */}
          <TabsContent value="items" className="space-y-4 pt-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", Math.max(1, Number(e.target.value)))
                      }
                    />
                  </div>
                  <div className="w-32">
                    <InputCurrency
                      value={item.unitPrice > 0 ? (item.unitPrice / 100).toFixed(2) : ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const cents = Math.round(parseCurrency(e.target.value) * 100);
                        updateItem(item.id, "unitPrice", cents);
                      }}
                      placeholder="$0.00"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Remove invoice item`}
                    onClick={() => removeItem(item.id)}
                    disabled={items.length <= 1}
                  >
                    <TrashIcon className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addItem}>
              <PlusIcon className="mr-1 h-4 w-4" />
              Add Item
            </Button>

            {/* Subtotal */}
            <div className="flex justify-between border-t pt-3">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="text-sm font-bold">{formatCents(total)}</span>
            </div>
          </TabsContent>

          {/* ===== Tab 2: Payment Terms ===== */}
          <TabsContent value="terms" className="space-y-5 pt-4">
            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
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

            {/* Due Date Terms (for one_time) */}
            {paymentType === "one_time" && (
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Select
                  value={dueDateTerms}
                  onValueChange={(v) => setDueDateTerms(v as DueDateTerms)}
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
                {dueDateTerms === "custom" && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={customDueDateMode === "days" ? "default" : "outline"}
                        onClick={() => setCustomDueDateMode("days")}
                      >
                        Days from signing
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={customDueDateMode === "date" ? "default" : "outline"}
                        onClick={() => setCustomDueDateMode("date")}
                      >
                        Specific date
                      </Button>
                    </div>
                    {customDueDateMode === "days" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={customDueDays}
                          onChange={(e) => setCustomDueDays(Number(e.target.value))}
                        />
                        <span className="text-muted-foreground text-sm">days</span>
                      </div>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            {customDueDate ? format(customDueDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDueDate}
                            onSelect={setCustomDueDate}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recurring config */}
            {paymentType === "recurring" && (
              <div className="space-y-4 rounded-lg border p-4">
                <span className="text-sm font-medium">Recurring Schedule</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Every</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={recurringIntervalCount}
                    onChange={(e) => setRecurringIntervalCount(Math.max(1, Number(e.target.value)))}
                  />
                  <Select
                    value={recurringInterval}
                    onValueChange={(v) => setRecurringInterval(v as RecurringInterval)}
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
                <div className="space-y-2">
                  <Label>End Condition</Label>
                  <Select
                    value={recurringEndCondition}
                    onValueChange={(v) => setRecurringEndCondition(v as RecurringEndCondition)}
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
                  {recurringEndCondition === "after_count" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={recurringEndAfterCount}
                        onChange={(e) =>
                          setRecurringEndAfterCount(Math.max(1, Number(e.target.value)))
                        }
                      />
                      <span className="text-muted-foreground text-sm">payments</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Installments config */}
            {paymentType === "installments" && (
              <div className="space-y-4 rounded-lg border p-4">
                <span className="text-sm font-medium">Installment Plan</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Payments</Label>
                    <Input
                      type="number"
                      min={2}
                      value={installmentsCount}
                      onChange={(e) => setInstallmentsCount(Math.max(2, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Interval</Label>
                    <Select
                      value={installmentsInterval}
                      onValueChange={(v) => setInstallmentsInterval(v as InstallmentInterval)}
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
                </div>
                {total > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {installmentsCount} payments of{" "}
                    <span className="font-medium">
                      {formatCents(Math.ceil(total / installmentsCount))}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Deposit + Balance config */}
            {paymentType === "deposit_balance" && (
              <div className="space-y-4 rounded-lg border p-4">
                <span className="text-sm font-medium">Deposit & Balance</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deposit (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={depositPercent}
                      onChange={(e) =>
                        setDepositPercent(Math.max(1, Math.min(99, Number(e.target.value))))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Balance Due (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={balanceDueDays}
                      onChange={(e) => setBalanceDueDays(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                </div>
                {total > 0 && (
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>
                      Deposit:{" "}
                      <span className="font-medium">
                        {formatCents(Math.round((total * depositPercent) / 100))}
                      </span>{" "}
                      ({depositPercent}%)
                    </p>
                    <p>
                      Balance:{" "}
                      <span className="font-medium">
                        {formatCents(total - Math.round((total * depositPercent) / 100))}
                      </span>{" "}
                      due in {balanceDueDays} days
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Late Fees */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Late Fees</Label>
                  <p className="text-muted-foreground text-xs">Charge fees for overdue payments</p>
                </div>
                <Switch checked={lateFeeEnabled} onCheckedChange={setLateFeeEnabled} />
              </div>
              {lateFeeEnabled && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={lateFeeType}
                      onValueChange={(v) => setLateFeeType(v as LateFeeType)}
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
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {lateFeeType === "percentage" ? "Rate (%)" : "Amount"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={lateFeeType === "percentage" ? 0.5 : 1}
                      value={lateFeeAmount}
                      onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grace (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={lateFeeGraceDays}
                      onChange={(e) => setLateFeeGraceDays(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fee Handling */}
            <div className="space-y-2 border-t pt-4">
              <Label>Platform Fee Handling</Label>
              <Select value={feeHandling} onValueChange={(v) => setFeeHandling(v as FeeHandling)}>
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
          </TabsContent>

          {/* ===== Tab 3: Payment Methods & Tax ===== */}
          <TabsContent value="methods" className="space-y-5 pt-4">
            {/* Payment Methods */}
            <div className="space-y-3">
              <Label>Accepted Payment Methods</Label>
              <div className="space-y-2">
                {(
                  [
                    { key: "card", label: "Credit / Debit Card" },
                    { key: "ach_debit", label: "ACH Direct Debit" },
                    { key: "apple_pay", label: "Apple Pay (auto-enabled with Card)" },
                    { key: "google_pay", label: "Google Pay (auto-enabled with Card)" },
                    { key: "link", label: "Saved checkout profile" },
                  ] as const
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <Checkbox
                      checked={paymentMethods[key]}
                      onCheckedChange={(checked) =>
                        setPaymentMethods((prev) => ({ ...prev, [key]: !!checked }))
                      }
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tax */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Tax</Label>
                  <p className="text-muted-foreground text-xs">
                    Enable automatic tax calculation through Vortex Payments
                  </p>
                </div>
                <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
              </div>
              {taxEnabled && (
                <div className="space-y-2">
                  <Label className="text-xs">Tax Behavior</Label>
                  <Select
                    value={taxBehavior}
                    onValueChange={(v) => setTaxBehavior(v as TaxBehavior)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive (added on top)</SelectItem>
                      <SelectItem value="inclusive">Inclusive (included in price)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 border-t pt-4">
          <div className="flex flex-1 items-center gap-2">
            <Badge variant="outline" className="border-field-payment-border text-field-payment">
              Total: {formatCents(total)}
            </Badge>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
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
      </DialogContent>
    </Dialog>
  );
}
