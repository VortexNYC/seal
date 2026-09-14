/**
 * Dashboard Export Dialog Component
 */

import { Button } from "@cloudflare/kumo/components/button";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ExportDataDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Export Documents Data</DialogTitle>
          <DialogDescription>
            Document exports are being migrated to the Cloudflare Worker data
            layer. Exporting will be available once the dashboard data endpoints
            are ready.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
