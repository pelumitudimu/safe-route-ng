import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map as MapIcon,
  Flag,
  Route as RouteIcon,
  Bell,
  User,
  Users,
  Siren,
  Bot,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useNavSignals } from "@/hooks/use-nav-signals";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Live Map", icon: MapIcon },
  { to: "/assistant", label: "Fayol", icon: Bot },
  { to: "/report", label: "Report", icon: Flag },
  { to: "/safe-route", label: "Safe Route", icon: RouteIcon },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/circle", label: "Family & Friends", icon: Users },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/report", label: "Report", icon: Flag },
  { to: "/assistant", label: "Fayol", icon: Bot },
  { to: "/circle", label: "Circle", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppLayout({
  title,
  action,
  children,
  fullBleed,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { recentIncidents, pendingCircle, unreadAlerts } = useNavSignals();

  const badgeFor = (to: string): number | undefined => {
    if (to === "/alerts") return unreadAlerts || recentIncidents || undefined;
    if (to === "/circle") return pendingCircle || undefined;
    return undefined;
  };

  const initials = (profile?.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-5 md:flex">
        <Link to="/dashboard" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const badge = badgeFor(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
                {badge ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/sos"
          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-sos px-3 py-3 text-sm font-bold text-sos-foreground transition-transform hover:scale-[1.02]"
        >
          <Siren className="h-4.5 w-4.5" /> Emergency SOS
        </Link>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-8">
          <Link to="/dashboard" className="md:hidden">
            <Logo showText={false} />
          </Link>
          <h1 className="truncate font-display text-lg font-bold md:text-xl">{title}</h1>
          <div className="ml-auto flex items-center gap-1">
            {action}
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full outline-none ring-ring focus-visible:ring-2">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{profile?.display_name || "Member"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className={cn(fullBleed ? "" : "px-4 py-6 md:px-8 md:py-8", "pb-24 md:pb-8")}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.to;
          const isReport = item.to === "/report";
          const badge = badgeFor(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {badge ? (
                <span className="absolute right-3 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
              <span
                className={cn(
                  "flex items-center justify-center",
                  isReport &&
                    "h-10 w-10 -translate-y-3 rounded-full bg-gradient-primary text-primary-foreground shadow-glow",
                )}
              >
                <item.icon className={cn(isReport ? "h-5 w-5" : "h-5 w-5")} />
              </span>
              <span className={cn(isReport && "-translate-y-2")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
