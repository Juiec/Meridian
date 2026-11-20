"use client";

import { ChatScreen } from "@/components/chat-screen";

/** Image Studio and Travel Planner take the left. The current chat stays beside them. */
export function ToolBesideChat({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-[1.4] flex-col border-b border-border lg:border-r lg:border-b-0">
        {children}
      </div>
      <section aria-label="Chat" className="flex h-[min(46dvh,28rem)] min-h-0 w-full min-w-0 flex-col lg:h-auto lg:w-[min(34vw,28rem)] lg:shrink-0">
        <ChatScreen companion />
      </section>
    </div>
  );
}
