"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2, Mail, ShieldCheck, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  disabled?: boolean;
};

const ITEMS: Item[] = [
  { href: "/settings/users", label: "Users", icon: Users, description: "Add staff, change roles, assign center access" },
  { href: "/settings/centers", label: "Centers", icon: Building2, description: "Add centers, set alert thresholds, brand the donation page" },
  { href: "/settings/campaigns", label: "Campaigns", icon: Megaphone, description: "Add funds and campaigns donors can give to" },
  { href: "/settings/integrations", label: "Email integrations", icon: Mail, description: "Connect Outlook so emails come from your address" },
  { href: "/settings/auth", label: "Auth", icon: ShieldCheck, description: "Auth0 sign-in (Phase 0.5)", disabled: true },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="w-60 flex-shrink-0 border-r border-border pr-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Settings
      </div>
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const content = (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
                !active && !item.disabled && "hover:bg-muted",
                item.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className={cn("font-medium", active && "text-sidebar-accent-foreground")}>
                  {item.label}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {item.description}
                </div>
              </div>
            </div>
          );
          return (
            <li key={item.href}>
              {item.disabled ? content : <Link href={item.href}>{content}</Link>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
