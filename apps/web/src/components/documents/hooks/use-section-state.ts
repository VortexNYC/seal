import { useCallback, useEffect, useState } from "react";

/**
 * Manages collapsible section open/close state for the document sidebar.
 * Auto-opens the "insights" section when AI annotations arrive.
 */
export function useSectionState(hasAnnotations: boolean) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["fields", "recipients", "your-signature", "invoice"])
  );

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Auto-open Insights section when annotations arrive
  useEffect(() => {
    if (hasAnnotations) {
      setOpenSections((prev) => {
        if (prev.has("insights")) return prev;
        return new Set([...prev, "insights"]);
      });
    }
  }, [hasAnnotations]);

  return { openSections, toggleSection };
}
