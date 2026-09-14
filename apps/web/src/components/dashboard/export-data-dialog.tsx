/**
 * Dashboard Export Dialog Component
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DownloadSimple } from "@phosphor-icons/react";
import { useState } from "react";

export function ExportDataDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <Dialog.Trigger
        render={
          <Button variant="outline" size="sm" icon={DownloadSimple}>
            Export
          </Button>
        }
      />
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Export Documents Data</Dialog.Title>
        <Dialog.Description>
          Document exports are being migrated to the Cloudflare Worker data
          layer. Exporting will be available once the dashboard data endpoints
          are ready.
        </Dialog.Description>
      </Dialog>
    </Dialog.Root>
  );
}
