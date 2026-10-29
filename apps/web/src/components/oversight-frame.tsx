import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

function useMinWidth(pixels: number): boolean {
  const query = `(min-width: ${pixels}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => {
      setMatches(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, [query]);

  return matches;
}

export function OversightFrame({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}): ReactElement {
  const wide = useMinWidth(1024);
  const header = (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
      <Text as="h2" size="sm" bold>
        {title}
      </Text>
      <Button
        type="button"
        variant="ghost"
        shape="square"
        size="sm"
        aria-label="Close details"
        icon={X}
        onClick={onClose}
      />
    </div>
  );

  if (wide) {
    return (
      <aside
        className="border-kumo-line bg-kumo-base hidden w-80 shrink-0 flex-col border-l lg:flex"
        data-testid="oversight-rail"
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    );
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog className="p-0">
        <div data-testid="oversight-sheet">
          {header}
          <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
