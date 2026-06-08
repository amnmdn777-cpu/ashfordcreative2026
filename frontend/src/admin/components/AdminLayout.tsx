import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Code2,
  Inbox,
  CreditCard,
  ClipboardList,
  ScrollText,
  GraduationCap,
  ShieldCheck,
  FileText,
  BookOpen,
  Bell,
  LogOut,
  Menu,
  X,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@admin/lib/auth";
import { api } from "@admin/lib/api";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notifications", label: "Mentions", icon: Bell },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/reps", label: "Sales reps", icon: UserCog },
  { href: "/custom-dev", label: "Custom dev quotes", icon: Code2 },
  { href: "/contact-requests", label: "Contact requests", icon: Inbox },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/onboardings", label: "Client onboarding", icon: ClipboardList },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/transcripts", label: "Transcripts", icon: FileText },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/editorial", label: "Editorial queue", icon: BookOpen },
  { href: "/candidates", label: "Candidates", icon: GraduationCap },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  // System status: surface critical infra misconfiguration (e.g. Stripe
  // webhook secret missing in prod) as a persistent banner. Polled every
  // few minutes — gauge, not real-time, so we don't hammer the API.
  const { data: status } = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: () => api.systemStatus(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  // Voice cost-cap status — polled on the same cadence as the Dashboard
  // widget so that the layout-level banner lights up the moment the
  // circuit-breaker trips, no matter which page the admin is viewing.
  const { data: voiceCost } = useQuery({
    queryKey: ["admin", "voice-cost-today"],
    queryFn: () => api.voiceCostToday(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const showWebhookBanner = Boolean(
    status && status.isProd && !status.stripeWebhookConfigured,
  );
  // The Twilio Voice banner that used to live here was retired on
  // 2026-04-28: voice migrated to Dialpad in #185, the wire field stayed
  // mis-named "twilioVoice*", and the founder rightly asked "wth is
  // this?" when the live admin started shouting at her to set
  // TWILIO_VOICE_NUMBER she would never use. Voice readiness is still
  // surfaced — but on the Dashboard's diagnostics widget where it can
  // name the right provider and the right env vars.
  // Cost-cap banner — shown the moment the daily voice-spend cap trips
  // OR usage hits the circuit-breaker threshold. The banner is red
  // (destructive) rather than amber so it visually outranks the
  // misconfiguration warnings: when this is on, no further outbound
  // calls go out until midnight America/Chicago.
  const showCostCapBanner = Boolean(
    voiceCost && (voiceCost.tripped === true || voiceCost.blocked === true),
  );
  // 2026-05-14: unread @Ashford mentions count for the sidebar pill —
  // a rep writing "@Ashford …" in a note creates an admin_notifications
  // row of kind=rep_tag. Poll every 30s so the badge feels live without
  // hammering the API.
  const { data: notifData } = useQuery({
    queryKey: ["admin-notifications", "unread-count"],
    queryFn: () => api.listAdminNotifications(true),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const unreadMentions = (notifData?.notifications ?? []).filter(
    (n) => !n.readAt,
  ).length;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed md:static z-30 inset-y-0 left-0 w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <div>
            <div className="font-serif text-lg leading-tight">Ashford</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-primary">
              Admin
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
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            const showBadge = href === "/notifications" && unreadMentions > 0;
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
                {showBadge && (
                  <span
                    data-testid="sidebar-mentions-badge"
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none"
                    aria-label={`${unreadMentions} unread mentions`}
                  >
                    {unreadMentions > 99 ? "99+" : unreadMentions}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/70 mb-2 truncate">
            {user?.displayName} · {user?.role}
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

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
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
          <div className="font-serif">Ashford Admin</div>
        </header>
        {showWebhookBanner && (
          <div
            role="alert"
            className="bg-destructive text-destructive-foreground border-b border-destructive/40 px-4 py-3"
            data-testid="banner-stripe-webhook-missing"
          >
            <div className="flex items-start gap-3 max-w-5xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm leading-snug">
                <strong className="font-semibold">
                  Stripe webhook is not configured.
                </strong>{" "}
                Customer payments are succeeding but onboarding records,
                welcome emails, and rep commissions are <em>not</em> being
                created. Add <code className="font-mono">STRIPE_WEBHOOK_SECRET</code>{" "}
                in the deployment Secrets panel and restart the API server.
              </div>
            </div>
          </div>
        )}
        {showCostCapBanner && voiceCost && (
          <div
            role="alert"
            className="bg-destructive text-destructive-foreground border-b border-destructive/40 px-4 py-3"
            data-testid="banner-voice-cost-cap"
          >
            <div className="flex items-start gap-3 max-w-5xl mx-auto">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm leading-snug">
                <strong className="font-semibold">
                  Daily voice spend cap reached.
                </strong>{" "}
                Outbound calls are blocked until midnight Central Time. Used{" "}
                <span className="font-mono">
                  ${voiceCost.spentUsd.toFixed(2)}
                </span>{" "}
                of{" "}
                <span className="font-mono">
                  ${voiceCost.capUsd.toFixed(2)}
                </span>{" "}
                across {voiceCost.callCount} call
                {voiceCost.callCount === 1 ? "" : "s"}. Raise the daily cost
                cap if this is expected, or investigate the burn rate on the
                dashboard.
              </div>
            </div>
          </div>
        )}
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
        <h1 className="font-serif text-2xl md:text-3xl text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
