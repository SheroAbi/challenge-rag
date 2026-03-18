"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Globale AppShell.
 * Verwaltet das Desktop- und Mobile-Layout (Overlay-Drawer für Sidebar).
 */

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const pathname = usePathname();

  // Schließe Drawer automatisch bei Routenwechsel
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDrawerOpen(false);
  }, [pathname]);

  // Schließe Drawer bei Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    if (isDrawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Verhindere Scrollen im Hintergrund, wenn Drawer offen ist
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [isDrawerOpen]);

  return (
    <div className="min-h-dvh flex bg-background w-full">
      
      {/* ===== Desktop Sidebar (lg und größer) ===== */}
      <motion.div 
        className="hidden lg:block sticky top-0 h-dvh shrink-0 z-40"
        initial={false}
        animate={{ width: isDesktopCollapsed ? "6rem" : "19rem" }}
        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 1 }}
      >
        <AppSidebar 
          isCollapsed={isDesktopCollapsed} 
          onToggleCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)} 
        />
      </motion.div>

      {/* ===== Mobile Menu Trigger ===== */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-40 lg:hidden flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95"
        aria-label="Navigation Menü öffnen"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* ===== Mobile Drawer Overlay (unter lg) ===== */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ opacity: 0, x: "-100%", scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: "-100%", scale: 0.95 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 z-50 p-0 sm:p-0 lg:hidden"
            >
              <div className="relative h-full">
                {/* Close Button inside Drawer padding but outside sidebar */}
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute -right-12 top-4 rounded-full bg-background/80 p-2 text-foreground backdrop-blur-md shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
                  aria-label="Menü schließen"
                >
                  <X className="h-5 w-5" />
                </button>
                
                <AppSidebar onLinkClick={() => setIsDrawerOpen(false)} isMobile />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Hauptinhalt ===== */}
      <main className="flex-1 w-full min-w-0 flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
