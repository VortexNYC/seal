/**
 * Dashboard Export Dialog Component
 * SEA-132: Export functionality for dashboard data (CSV, PDF reports)
 */

import { useQuery } from "convex/react";
import { format, subDays, subMonths } from "date-fns";
import {
  CalendarIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@seal/backend/convex/_generated/api";

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

type WorkflowStatus =
  | "all"
  | "draft"
  | "sent"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined";

const QUICK_RANGES = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 3 months", value: "3m" },
  { label: "Last 6 months", value: "6m" },
  { label: "Last year", value: "1y" },
  { label: "All time", value: "all" },
];

export function ExportDataDialog() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus>("all");
  const [quickRange, setQuickRange] = useState("30d");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isExporting, setIsExporting] = useState(false);

  // Calculate date range based on quick selection
  const getDateRangeFromQuick = (value: string): DateRange => {
    const now = new Date();
    switch (value) {
      case "7d":
        return { from: subDays(now, 7), to: now };
      case "30d":
        return { from: subDays(now, 30), to: now };
      case "3m":
        return { from: subMonths(now, 3), to: now };
      case "6m":
        return { from: subMonths(now, 6), to: now };
      case "1y":
        return { from: subMonths(now, 12), to: now };
      case "all":
        return { from: undefined, to: undefined };
      default:
        return { from: subDays(now, 30), to: now };
    }
  };

  const handleQuickRangeChange = (value: string) => {
    setQuickRange(value);
    setDateRange(getDateRangeFromQuick(value));
  };

  // Query export data
  const exportData = useQuery(
    api.dashboard.queries.getDocumentsForExport,
    open
      ? {
          workflowStatus: statusFilter === "all" ? undefined : statusFilter,
          startDate: dateRange.from?.getTime(),
          endDate: dateRange.to?.getTime(),
        }
      : "skip",
  );

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "yyyy-MM-dd HH:mm");
  };

  const handleExportCSV = () => {
    if (!exportData || exportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      // Build CSV header
      const headers = [
        "Document Name",
        "Status",
        "Owner",
        "Owner Email",
        "Created At",
        "Sent At",
        "Completed At",
        "Deadline",
        "Total Recipients",
        "Signed",
        "Pending",
      ];

      // Build CSV rows
      const rows = exportData.map((doc) => [
        `"${doc.name.replace(/"/g, '""')}"`,
        doc.status,
        `"${doc.ownerName.replace(/"/g, '""')}"`,
        doc.ownerEmail,
        formatDate(doc.createdAt),
        formatDate(doc.sentAt),
        formatDate(doc.completedAt),
        formatDate(doc.deadline),
        doc.recipientCount,
        doc.signedCount,
        doc.pendingCount,
      ]);

      // Combine header and rows
      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `documents-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDetailedCSV = () => {
    if (!exportData || exportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      // Build detailed CSV with one row per recipient
      const headers = [
        "Document Name",
        "Document Status",
        "Owner",
        "Created At",
        "Recipient Email",
        "Recipient Name",
        "Recipient Role",
        "Recipient Status",
        "Signed At",
        "Viewed At",
      ];

      const rows: string[][] = [];
      for (const doc of exportData) {
        if (doc.recipients.length === 0) {
          // Document with no recipients
          rows.push([
            `"${doc.name.replace(/"/g, '""')}"`,
            doc.status,
            `"${doc.ownerName.replace(/"/g, '""')}"`,
            formatDate(doc.createdAt),
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
        } else {
          for (const recipient of doc.recipients) {
            rows.push([
              `"${doc.name.replace(/"/g, '""')}"`,
              doc.status,
              `"${doc.ownerName.replace(/"/g, '""')}"`,
              formatDate(doc.createdAt),
              recipient.email,
              `"${recipient.name.replace(/"/g, '""')}"`,
              recipient.role,
              recipient.status,
              formatDate(recipient.signedAt),
              formatDate(recipient.viewedAt),
            ]);
          }
        }
      }

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `documents-detailed-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Detailed CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Documents Data</DialogTitle>
          <DialogDescription>
            Export your documents data as CSV for reporting and analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Document Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as WorkflowStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Select value={quickRange} onValueChange={handleQuickRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {QUICK_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] w-full justify-start text-left font-normal sm:min-h-0"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      format(dateRange.from, "MMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">Start date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => {
                      setDateRange((prev) => ({ ...prev, from: date }));
                      setQuickRange("custom");
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] w-full justify-start text-left font-normal sm:min-h-0"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? (
                      format(dateRange.to, "MMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">End date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => {
                      setDateRange((prev) => ({ ...prev, to: date }));
                      setQuickRange("custom");
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Data Preview */}
          <div className="bg-muted/30 rounded-md border p-4">
            <div className="text-sm">
              {exportData === undefined ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Loading data...
                </div>
              ) : (
                <>
                  <span className="font-medium">{exportData.length}</span> documents match your
                  filters
                </>
              )}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="space-y-2">
            <Button
              className="min-h-[44px] w-full"
              onClick={handleExportCSV}
              disabled={isExporting || !exportData || exportData.length === 0}
            >
              {isExporting ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
              )}
              Export Summary CSV
            </Button>
            <Button
              className="min-h-[44px] w-full"
              variant="outline"
              onClick={handleExportDetailedCSV}
              disabled={isExporting || !exportData || exportData.length === 0}
            >
              {isExporting ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileTextIcon className="mr-2 h-4 w-4" />
              )}
              Export Detailed CSV (with recipients)
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Summary CSV includes one row per document. Detailed CSV includes one row per recipient
            for comprehensive tracking.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
