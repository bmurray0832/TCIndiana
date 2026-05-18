"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  HandHeart,
  MessageSquare,
  DollarSign,
  CheckSquare,
  FileBarChart,
  Settings,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/follow-ups", label: "Follow-Ups", icon: CheckSquare },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/prospects", label: "Prospects", icon: UserPlus },
      { href: "/donors", label: "Donors", icon: HandHeart },
      { href: "/contacts", label: "Contact Log", icon: MessageSquare },
    ],
  },
  {
    label: "Giving",
    items: [
      { href: "/donations", label: "Donations", icon: DollarSign },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Link href="/dashboard" className="flex items-center gap-2 border-b border-sidebar-border px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Heart className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">TC Indiana</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CRM</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/40",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        Dev mode — auth shim
      </div>
    </aside>
  );
}
