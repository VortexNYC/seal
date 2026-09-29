import { useCallback, useEffect, useState } from "react";

/**
 * Manages collapsible section open/close state for the document sidebar.
 * Auto-opens the "insights" section when AI annotations arrive.
 */
export function useSectionState(hasAnnotations: boolean) {
  // Draft send path: people + fields open; power sections stay closed.
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["recipients", "fields", "your-signature"])
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
