import { useCallback, useState } from "react";

/**
 * Manages collapsible section open/close state for the document sidebar.
 */
export function useSectionState() {
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

  return { openSections, toggleSection };
}
