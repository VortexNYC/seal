import { Button } from "@cloudflare/kumo/components/button";
import { ArrowLeft } from "@phosphor-icons/react";
import type { JSX } from "react";

export function RailBack({
  onBack,
  tip,
}: {
  onBack: () => void;
  tip: string;
}): JSX.Element {
  return (
    <span title={tip} className="inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        onClick={onBack}
      >
        Back
      </Button>
    </span>
  );
}
