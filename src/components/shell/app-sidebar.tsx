"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  Sparkles,
  Info,
  ExternalLink,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { motion } from "framer-motion";

const PRODUCT_NAV = [
  { href: "/", label: "Startseite", icon: Sparkles },
  { href: "/about", label: "Über das Projekt", icon: Info },
];

const APP_NAV = [
  { href: "/knowledge", label: "Wissensbasis", icon: Database },
];

interface AppSidebarProps {
  onLinkClick?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}

export function AppSidebar({ onLinkClick, isCollapsed, onToggleCollapse, isMobile }: AppSidebarProps) {
  const pathname = usePathname();

  // Animation Variants für Apple-like Smoothness
  const transitionSettings = { type: "spring" as const, stiffness: 350, damping: 35, mass: 0.8 };


  const textVariants = {
    expanded: { opacity: 1, width: "auto", marginLeft: "12px", display: "block", filter: "blur(0px)" },
    collapsed: { opacity: 0, width: 0, marginLeft: "0px", transitionEnd: { display: "none" }, filter: "blur(4px)" }
  };

  const sectionLabelVariants = {
    expanded: { opacity: 1, height: "auto", marginTop: "1rem", marginBottom: "0.5rem", filter: "blur(0px)" },
    collapsed: { opacity: 0, height: 0, marginTop: "0rem", marginBottom: "0rem", filter: "blur(4px)" }
  };

  const logoVariants = {
    expanded: { opacity: 1, scale: 1, x: 0 },
    collapsed: { opacity: 0, scale: 0.5, x: -20, pointerEvents: "none" as const }
  };

  const footerExpandedVariants = {
    expanded: { opacity: 1, height: "auto", display: "flex", filter: "blur(0px)" },
    collapsed: { opacity: 0, height: 0, transitionEnd: { display: "none" }, filter: "blur(4px)" }
  };
  
  const footerCollapsedVariants = {
    expanded: { opacity: 0, height: 0, transitionEnd: { display: "none" }, filter: "blur(4px)" },
    collapsed: { opacity: 1, height: "auto", display: "flex", filter: "blur(0px)" }
  };

  return (
    <aside className="h-full w-full flex flex-col bg-background/60 backdrop-blur-2xl border-y border-r border-l-0 border-border/50 rounded-r-[2rem] rounded-l-none shadow-[20px_0_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden">
      
      {/* Brand Header & Toggle */}
      <div className="relative flex items-center h-[88px] shrink-0 w-full px-6">
        
        {/* Logo Container (verschwindet beim Einklappen) */}
        <motion.div 
          className="flex items-center gap-3 absolute left-6 overflow-hidden origin-left"
          variants={logoVariants}
          initial={isCollapsed ? "collapsed" : "expanded"}
          animate={isCollapsed ? "collapsed" : "expanded"}
          transition={transitionSettings}
        >
          <Link 
            href="/" 
            onClick={onLinkClick}
            className="flex items-center gap-3 group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
               <Sparkles className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0 flex-1 whitespace-nowrap">
               <div className="truncate text-base font-bold text-foreground">
                 Everlast RAG
               </div>
               <div className="truncate text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">
                 Challenge
               </div>
            </div>
          </Link>
        </motion.div>
        
        {/* Toggle Button (zentriert sich beim Einklappen) */}
        {!isMobile && (
          <motion.button
            onClick={onToggleCollapse}
            className="absolute flex h-10 w-10 items-center justify-center rounded-xl bg-background/50 border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm z-50"
            variants={{
              expanded: { left: "15rem" },
              collapsed: { left: "1.5rem" }
            }}
            initial={isCollapsed ? "collapsed" : "expanded"}
            animate={isCollapsed ? "collapsed" : "expanded"}
            transition={transitionSettings}
            title={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              key={isCollapsed ? "collapsed" : "expanded"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </motion.div>
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 scrollbar-hide flex flex-col items-center w-full">
        
        {/* Produkt Navigation */}
        <div className="w-full">
          <motion.div 
            variants={sectionLabelVariants}
            initial={isCollapsed ? "collapsed" : "expanded"}
            animate={isCollapsed ? "collapsed" : "expanded"}
            transition={transitionSettings}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-2 whitespace-nowrap"
          >
            Produkt
          </motion.div>

          <nav className="space-y-2 flex flex-col items-center w-full">
            {PRODUCT_NAV.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={`group relative flex items-center rounded-xl transition-all duration-300 overflow-hidden ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                  style={{ width: "100%", height: "2.75rem" }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <motion.div 
                    className="flex items-center h-full absolute"
                    variants={{
                      expanded: { left: "12px" },
                      collapsed: { left: "calc(50% - 9px)" }
                    }}
                    initial={isCollapsed ? "collapsed" : "expanded"}
                    animate={isCollapsed ? "collapsed" : "expanded"}
                    transition={transitionSettings}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                  </motion.div>

                  <motion.div 
                    variants={textVariants}
                    initial={isCollapsed ? "collapsed" : "expanded"}
                    animate={isCollapsed ? "collapsed" : "expanded"}
                    transition={transitionSettings}
                    className="text-sm font-medium whitespace-nowrap absolute"
                    style={{ left: "40px" }}
                  >
                    {item.label}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* App Navigation */}
        <div className="w-full mt-4">
          <motion.div 
            variants={sectionLabelVariants}
            initial={isCollapsed ? "collapsed" : "expanded"}
            animate={isCollapsed ? "collapsed" : "expanded"}
            transition={transitionSettings}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-2 whitespace-nowrap"
          >
            RAG Portal
          </motion.div>

          <nav className="space-y-2 flex flex-col items-center w-full">
            {APP_NAV.map((item) => {
              const fullHref = item.href;
              const isActive = pathname?.startsWith(fullHref);
              
              return (
                <Link
                  key={item.href}
                  href={fullHref}
                  onClick={onLinkClick}
                  className={`group relative flex items-center rounded-xl transition-all duration-300 overflow-hidden ${
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                  style={{ width: "100%", height: "2.75rem" }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <motion.div 
                    className="flex items-center h-full absolute"
                    variants={{
                      expanded: { left: "12px" },
                      collapsed: { left: "calc(50% - 9px)" }
                    }}
                    initial={isCollapsed ? "collapsed" : "expanded"}
                    animate={isCollapsed ? "collapsed" : "expanded"}
                    transition={transitionSettings}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                  </motion.div>

                  <motion.div 
                    variants={textVariants}
                    initial={isCollapsed ? "collapsed" : "expanded"}
                    animate={isCollapsed ? "collapsed" : "expanded"}
                    transition={transitionSettings}
                    className="text-sm font-semibold whitespace-nowrap absolute"
                    style={{ left: "40px" }}
                  >
                    {item.label}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Utilities Footer */}
      <div className="p-4 border-t border-border/40 bg-muted/10 shrink-0 min-h-[140px] flex items-center justify-center flex-col relative">
        
        {/* Expanded Footer Content */}
        <motion.div 
          className="flex flex-col gap-3 w-full absolute top-4 px-4 m-0"
          variants={footerExpandedVariants}
          initial={isCollapsed ? "collapsed" : "expanded"}
          animate={isCollapsed ? "collapsed" : "expanded"}
          transition={transitionSettings}
        >
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Theme</span>
            <ThemeToggle />
          </div>
          
          <Link
            href="/api/health"
            target="_blank"
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <span className="whitespace-nowrap">API Health</span>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </Link>
          

        </motion.div>

        {/* Collapsed Footer Content */}
        <motion.div 
          className="flex flex-col items-center gap-4 py-2 w-full absolute top-4 m-0"
          variants={footerCollapsedVariants}
          initial={isCollapsed ? "collapsed" : "expanded"}
          animate={isCollapsed ? "collapsed" : "expanded"}
          transition={transitionSettings}
        >
          <ThemeToggle />
          <Link
            href="/api/health"
            target="_blank"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/50 border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm group"
            title="API Health"
          >
            <ExternalLink className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
          </Link>
        </motion.div>

      </div>
    </aside>
  );
}
