import { createFileRoute } from "@tanstack/react-router";

import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";

export const Route = createFileRoute("/logo-test")({
  component: LogoTestPage,
});

function LogoTestPage() {
  return (
    <div className="min-h-screen space-y-20 bg-slate-50 p-10 dark:bg-slate-950">
      <section>
        <h2 className="mb-4 text-xl font-bold dark:text-white">Icon Only (Proportional)</h2>
        <div className="flex flex-wrap items-end gap-10">
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={32} />
            <span className="text-xs text-slate-500">32px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={64} />
            <span className="text-xs text-slate-500">64px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={120} />
            <span className="text-xs text-slate-500">120px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={240} />
            <span className="text-xs text-slate-500">240px</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold dark:text-white">With Text (Proportional)</h2>
        <div className="flex flex-wrap items-end gap-10">
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={32} withText />
            <span className="text-xs text-slate-500">32px height</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={64} withText />
            <span className="text-xs text-slate-500">64px height</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SealLogoBadgeFixed size={120} withText />
            <span className="text-xs text-slate-500">120px height</span>
          </div>
        </div>
      </section>
    </div>
  );
}
