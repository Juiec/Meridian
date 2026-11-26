"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { ChatScreen } from "@/components/chat-screen";
import { ShellOpenProvider } from "@/components/shell-context";
import { Sidebar } from "@/components/sidebar";
import { cn } from "cn";

export { useOpenSidebar } from "@/components/shell-context";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const home = pathname === "/";

  return (
    <ShellOpenProvider open={() => setSidebarOpen(true)}>
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
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", home && "hidden")}>
            {home ? null : children}
          </div>
          <section aria-label="Chat" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !home && "hidden")}>
            <ChatScreen />
          </section>
        </div>
      </div>
    </ShellOpenProvider>
  );
}
