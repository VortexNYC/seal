"use client";

import { createContext, useContext, type ReactElement, type ReactNode } from "react";

type WorkspaceShellValue = {
  slug: string;
};

const WorkspaceShellContext = createContext<WorkspaceShellValue | null>(null);

export function WorkspaceShellProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}): ReactElement {
  return (
    <WorkspaceShellContext.Provider value={{ slug }}>
      {children}
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShell(): WorkspaceShellValue {
  const value = useContext(WorkspaceShellContext);
  if (value === null) {
    throw new Error("useWorkspaceShell must be used within WorkspaceShellProvider");
  }
  return value;
}

export function useOptionalWorkspaceShell(): WorkspaceShellValue | null {
  return useContext(WorkspaceShellContext);
}
