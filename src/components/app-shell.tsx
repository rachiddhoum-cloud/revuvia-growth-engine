"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  FileText,
  CalendarDays,
  Magnet,
  BarChart3,
  Library,
  Settings,
  Sparkles,
  ShieldCheck,
  Target,
  Mail,
  Route,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "CEO Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/acquisition", label: "Acquisition", icon: Target, section: "Overview" },
  { href: "/inbox", label: "Founder Inbox", icon: Mail, section: "Overview" },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, section: "Overview" },
  { href: "/content-hub", label: "Content Hub", icon: Search, section: "Acquisition" },
  { href: "/journey", label: "Customer Journey", icon: Route, section: "Acquisition" },
  { href: "/sales", label: "Sales Intelligence", icon: HandCoins, section: "Acquisition" },
  { href: "/seo", label: "SEO Intelligence", icon: Search, section: "Modules" },
  { href: "/content", label: "Content Factory", icon: FileText, section: "Modules" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, section: "Modules" },
  { href: "/lead-magnets", label: "Lead Magnets", icon: Magnet, section: "Modules" },
  { href: "/analytics", label: "SEO Dashboard", icon: BarChart3, section: "Modules" },
  { href: "/library", label: "Content Library", icon: Library, section: "Modules" },
  { href: "/settings", label: "Settings", icon: Settings, section: "Workspace" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  let section: string | null = null;
  for (const item of NAV_ITEMS) {
    if (item.href !== "/" && pathname.startsWith(item.href)) {
      section = item.section;
      break;
    }
  }
  if (pathname === "/") section = "Overview";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Growth Engine</p>
            <p className="text-[10px] text-muted-foreground">Revuvia · AI Ops</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <div className="space-y-1">
            {NAV_ITEMS.filter((i) => i.section === "Overview").map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} />
            ))}
          </div>

          {["Modules", "Acquisition", "Workspace"].map((s) => (
            <div key={s} className="space-y-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {s}
              </p>
              {NAV_ITEMS.filter((i) => i.section === s).map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={item.href !== "/" && pathname.startsWith(item.href)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className="rounded-lg border border-dashed p-3 text-center">
            <p className="text-[10px] text-muted-foreground">API credits</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-500">Operational</p>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">
            {section ? `Growth Engine / ${section}` : "Growth Engine"}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
              Beta
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
