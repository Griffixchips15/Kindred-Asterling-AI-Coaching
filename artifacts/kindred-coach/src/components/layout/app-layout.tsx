import { Link, useLocation } from "wouter";
import { Home, Sunrise, ScanLine, Sunset, ListTodo, LogOut, Palette, Check, MessageCircle, Archive as ArchiveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
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

function ThemePicker({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const { theme, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((t) => t.value === theme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="theme-picker-trigger"
          >
            <Palette className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
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
          </button>
        ) : (
          <button
            className="flex flex-col items-center gap-1 p-2 min-w-[4rem] rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            data-testid="theme-picker-trigger-mobile"
          >
            <Palette className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-medium tracking-wide">Theme</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
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
  { icon: ArchiveIcon, label: "Archive", href: "/archive" },
];

const mobileNavItems = [
  { icon: Home, label: "Today", href: "/" },
  { icon: MessageCircle, label: "Chat", href: "/chat" },
  { icon: Sunrise, label: "Morning", href: "/morning" },
  { icon: Sunset, label: "Evening", href: "/evening" },
  { icon: ArchiveIcon, label: "Archive", href: "/archive" },
];

function ProfilePanel({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  if (!user) return null;
  const name = user.preferredName || user.firstName || user.email || "You";
  const initials = (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase();
  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Birthday", value: user.birthday ? safeFormatDate(user.birthday) : null },
    { label: "Working on", value: user.struggles },
    { label: "Strengths", value: user.strengths },
    { label: "Interests", value: user.interests },
  ];
  return (
    <div className="px-3 pb-3 pt-2">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold">
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

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar border-border">
        <div className="p-6">
          <h1 className="text-xl font-serif text-primary tracking-tight font-medium">Kindred</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Daily Wellness</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <ProfilePanel user={user} />
          <ThemePicker variant="sidebar" />
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
        <div className="max-w-2xl mx-auto p-4 md:p-8 min-h-full pb-24">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-lg z-50 pb-safe">
        <div className="flex items-center justify-around p-2">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 min-w-[4rem] rounded-lg transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          <ThemePicker variant="mobile" />
          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 p-2 min-w-[4rem] rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-medium tracking-wide">Log out</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
