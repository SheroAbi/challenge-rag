import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Everlast RAG – Intelligente Wissens-Suche",
  description:
    "Everlast RAG: KI-gestützte Wissens-Plattform mit semantischer Suche, Vektordatenbank und automatischer Antwortgenerierung.",
  keywords: ["Everlast", "RAG", "Knowledge Base", "AI", "Next.js", "Supabase"],
};

import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/shell/app-shell";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
