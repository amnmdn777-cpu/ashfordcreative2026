import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Search,
  ListChecks,
  CalendarClock,
  Inbox,
  Code2,
  Bell,
  DollarSign,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  BookOpen,
  MessageSquare,
  Snowflake,
} from "lucide-react";
import { useAuth } from "@rep/lib/auth";
import { api } from "@rep/lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: "messages";
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/available", label: "Available leads", icon: Search },
  { href: "/my-leads", label: "My leads", icon: ListChecks },
  { href: "/my-leads/cold", label: "Cold leads", icon: Snowflake },
  { href: "/callbacks", label: "Callbacks", icon: CalendarClock },
  { href: "/inbound", label: "Inbound queue", icon: Inbox },
  { href: "/custom-dev", label: "Custom dev quotes", icon: Code2 },
  { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/commission", label: "Commission", icon: DollarSign },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const NAV_RESOURCES = [
  { href: "/resources", label: "Resources", icon: BookOpen },
];

export default function RepLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data: unreadMsgs } = useQuery({
    queryKey: ["rep", "messages", "unread"],
    queryFn: () => api.unreadMessageCount(),
    refetchInterval: 30000,
    enabled: !!user && (user.role === "rep" || user.role === "admin"),
  });
  const badges: Record<string, number> = {
    messages: unreadMsgs?.unreadCount ?? 0,
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className={`fixed md:static z-30 inset-y-0 left-0 w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <div>
            <div className="font-serif text-lg leading-tight">Ashford</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-primary">
              Sales
            </div>
          </div>
          <button
            type="button"
            className="md:hidden p-1"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
            // `/my-leads` and `/my-leads/cold` are siblings — match exactly
            // when another nav entry starts with this href so the parent
            // doesn't light up while a child route is active.
            const hasChildEntry = NAV.some(
              (n) => n.href !== href && n.href.startsWith(`${href}/`),
            );
            const active = hasChildEntry
              ? location === href
              : location === href ||
                (href !== "/" && location.startsWith(href));
            const badgeCount = badgeKey ? badges[badgeKey] ?? 0 : 0;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="pt-3 pb-1">
            <div className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-widest">
              Knowledge base
            </div>
          </div>
          {NAV_RESOURCES.map(({ href, label, icon: Icon }) => {
            const active = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/70 mb-2 truncate">
            {user?.displayName} · promo {user?.promoCode}
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="font-serif">Ashford Sales</div>
        </header>
        <main className="flex-1 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
