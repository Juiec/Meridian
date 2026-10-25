"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("meridian-theme", next);
    } catch {
      // Ignore storage failures; the class still changes for this view.
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle color theme">
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
