"use client";

import { createContext, useContext, useState } from "react";

import { Sidebar } from "@/components/sidebar";

const ShellOpenContext = createContext<(() => void) | null>(null);

export function useOpenSidebar(): () => void {
  return useContext(ShellOpenContext) ?? (() => undefined);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sessions"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ShellOpenContext.Provider value={() => setSidebarOpen(true)}>{children}</ShellOpenContext.Provider>
      </div>
    </div>
  );
}
