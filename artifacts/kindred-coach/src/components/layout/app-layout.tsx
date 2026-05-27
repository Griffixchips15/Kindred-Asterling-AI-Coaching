import { Link, useLocation } from "wouter";
import {
  Home,
  Sunrise,
  ScanLine,
  Sunset,
  ListTodo,
  Pill,
  LogOut,
  Palette,
  Check,
  MessageCircle,
  Archive as ArchiveIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { format, parseISO } from "date-fns";
import { useTheme, THEME_OPTIONS, type ThemeName } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_STORAGE_KEY = "kindred:sidebar-collapsed";

function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  return [collapsed, setCollapsed];
}

function ThemePicker({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((t) => t.value === theme);

  const trigger = (
    <button
      className={cn(
        "flex items-center rounded-lg transition-colors text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent",
        collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"
      )}
      data-testid="theme-picker-trigger"
    >
      <Palette className="w-5 h-5 text-muted-foreground shrink-0" strokeWidth={2} />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Theme</span>
          <span className="flex gap-1">
            {current?.swatches.map((c) => (
              <span
                key={c}
                className="w-3 h-3 rounded-full border border-border"
                style={{ backgroundColor: c }}
              />
            ))}
          </span>
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">Theme</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-56">
        <DropdownMenuLabel>Color theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setTheme(opt.value as ThemeName)}
            className="flex items-center gap-3 cursor-pointer"
            data-testid={`theme-option-${opt.value}`}
          >
            <span className="flex gap-1">
              {opt.swatches.map((c) => (
                <span
                  key={c}
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="flex-1">{opt.label}</span>
            {theme === opt.value && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const navItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: MessageCircle, label: "Chat", href: "/chat" },
  { icon: Sunrise, label: "Morning", href: "/morning" },
  { icon: ScanLine, label: "Scans", href: "/scans" },
  { icon: Sunset, label: "Evening", href: "/evening" },
  { icon: ListTodo, label: "Habits", href: "/habits" },
  { icon: Pill, label: "Medications", href: "/medications" },
  { icon: ArchiveIcon, label: "Archive", href: "/archive" },
];

function ProfilePanel({
  user,
  collapsed,
}: {
  user: ReturnType<typeof useAuth>["user"];
  collapsed: boolean;
}) {
  if (!user) return null;
  const name = user.preferredName || user.firstName || user.email || "You";
  const initials = (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase();

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center p-2">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold">
              {initials || "·"}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    );
  }

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Birthday", value: user.birthday ? safeFormatDate(user.birthday) : null },
    { label: "Working on", value: user.struggles },
    { label: "Strengths", value: user.strengths },
    { label: "Interests", value: user.interests },
  ];
  return (
    <div className="px-3 pb-3 pt-2">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
          {initials || "·"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          {user.email && <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>}
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        {fields.map((f) => (
          <div key={f.label} className="text-[11px]">
            <span className="text-muted-foreground/80 uppercase tracking-wide">{f.label}</span>
            <p className={cn("text-foreground/90 leading-snug", !f.value && "text-muted-foreground/50 italic")}>
              {f.value || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function safeFormatDate(s: string): string {
  try {
    return format(parseISO(s), "PP");
  } catch {
    return s;
  }
}

function NavLinkItem({
  href,
  icon: Icon,
  label,
  isActive,
  collapsed,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-lg transition-colors text-sm font-medium",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
        isActive ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
      )}
      data-testid={`nav-${label.toLowerCase()}`}
    >
      <Icon
        className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
        strokeWidth={isActive ? 2.5 : 2}
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar border-border transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header with brand + collapse toggle */}
        <div
          className={cn(
            "flex items-center justify-between",
            collapsed ? "p-3 flex-col gap-2" : "p-6"
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-serif text-primary tracking-tight font-medium">Kindred</h1>
              <p className="text-sm text-muted-foreground mt-1 tracking-wide">Daily Wellness</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                data-testid="sidebar-toggle"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <PanelLeftClose className="w-5 h-5" strokeWidth={2} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        <nav className={cn("flex-1 space-y-1.5 mt-2", collapsed ? "px-2" : "px-4")}>
          {navItems.map((item) => (
            <NavLinkItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={location === item.href}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className={cn("border-t border-border space-y-1", collapsed ? "p-2" : "p-4")}>
          <ProfilePanel user={user} collapsed={collapsed} />
          <ThemePicker collapsed={collapsed} />
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="flex items-center justify-center p-2 rounded-lg transition-colors text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent"
                  data-testid="logout"
                >
                  <LogOut className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="logout"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
              Log out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-2xl mx-auto p-4 md:p-8 min-h-full">{children}</div>
      </main>
    </div>
  );
}
