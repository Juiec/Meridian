import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { AppStateProvider } from "@/components/app-state";
import { Shell } from "@/components/shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display-family",
  subsets: ["latin"],
});

const themeScript = `
try {
  var theme = localStorage.getItem("meridian-theme");
  if (theme === "light") document.documentElement.classList.remove("dark");
  else document.documentElement.classList.add("dark");
} catch (e) {}
`;

export const metadata: Metadata = {
  title: "Meridian",
  description: "A personal agent for a model you host, with sessions, skills, and bounded memory.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden">
        <AppStateProvider>
          <Shell>{children}</Shell>
        </AppStateProvider>
      </body>
    </html>
  );
}
