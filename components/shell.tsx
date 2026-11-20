"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { ShellOpenProvider } from "@/components/shell-context";
import { Sidebar } from "@/components/sidebar";
import { ToolBesideChat } from "@/components/tool-beside-chat";

export { useOpenSidebar } from "@/components/shell-context";

function isLeftTool(pathname: string): boolean {
  return pathname === "/images" || pathname === "/travel";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toolOnLeft = isLeftTool(pathname);

  return (
    <ShellOpenProvider open={() => setSidebarOpen(true)}>
      {toolOnLeft ? (
        <ToolBesideChat>{children}</ToolBesideChat>
      ) : (
        <div className="flex h-full min-h-0 bg-background text-foreground">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          {sidebarOpen ? (
            <button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-20 bg-black/40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      )}
    </ShellOpenProvider>
  );
}
