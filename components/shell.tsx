"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { ChatScreen } from "@/components/chat-screen";
import { ShellOpenProvider } from "@/components/shell-context";
import { Sidebar } from "@/components/sidebar";
import { cn } from "cn";

export { useOpenSidebar } from "@/components/shell-context";

function isLeftTool(pathname: string): boolean {
  return pathname === "/images" || pathname === "/travel";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const companion = isLeftTool(pathname);
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
        <div className={cn("flex min-h-0 min-w-0 flex-1", companion && "flex-col lg:flex-row")}>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              home && "hidden",
              companion ? "flex-[1.4] border-b border-border lg:border-r lg:border-b-0" : "flex-1",
            )}
          >
            {home ? null : children}
          </div>
          <section
            aria-label="Chat"
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              companion
                ? "h-[min(46dvh,28rem)] w-full lg:h-auto lg:w-[min(34vw,28rem)] lg:shrink-0"
                : "flex-1",
              !home && !companion && "hidden",
            )}
          >
            <ChatScreen companion={companion} />
          </section>
        </div>
      </div>
    </ShellOpenProvider>
  );
}
