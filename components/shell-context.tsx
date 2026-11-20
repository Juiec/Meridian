"use client";

import { createContext, useContext } from "react";

const ShellOpenContext = createContext<(() => void) | null>(null);

export function ShellOpenProvider({
  open,
  children,
}: {
  open: () => void;
  children: React.ReactNode;
}) {
  return <ShellOpenContext.Provider value={open}>{children}</ShellOpenContext.Provider>;
}

export function useOpenSidebar(): () => void {
  return useContext(ShellOpenContext) ?? (() => undefined);
}
