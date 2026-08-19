import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  Gauge, Kanban, MagnifyingGlass, Star, Gear, Compass, Package,
  TrendUp, Robot, Lock, SignOut, Sun, Moon, Buildings,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { to: "/dashboard", label: "Command Center", icon: Gauge },
  { to: "/build", label: "Build", icon: Compass, locked: true },
  { to: "/source", label: "Source", icon: Package, locked: true },
  { to: "/operate", label: "Operate", icon: Kanban },
  { to: "/scaleseo", label: "ScaleSEO", icon: MagnifyingGlass },
  { to: "/reviews", label: "Reviews", icon: Star },
  { to: "/grow", label: "Grow", icon: TrendUp, locked: true },
  { to: "/ai-team", label: "AI Team", icon: Robot, locked: true },
];

export default function AppShell() {
  const { user, business, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col fixed h-screen bg-card z-20" data-testid="app-sidebar">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary flex items-center justify-center">
              <span className="font-heading font-black text-primary-foreground text-lg leading-none">V</span>
            </div>
            <span className="font-heading font-black text-lg tracking-tighter">VENTURELYX</span>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="label-mono px-6 mb-2">Modules</p>
          <TooltipProvider delayDuration={150}>
            {NAV.map(({ to, label, icon: Icon, locked }) =>
              locked ? (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>
                    <div
                      data-testid={`nav-locked-${label.toLowerCase().replace(/\s/g, "-")}`}
                      className="flex items-center justify-between gap-3 px-6 py-2.5 text-muted-foreground/50 cursor-not-allowed select-none"
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={20} weight="duotone" />
                        <span className="text-sm font-medium">{label}</span>
                      </span>
                      <Lock size={14} weight="bold" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="rounded-none border border-border font-mono text-xs">
                    Coming soon
                  </TooltipContent>
                </Tooltip>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-2.5 text-sm font-medium border-l-2 transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`
                  }
                >
                  <Icon size={20} weight="duotone" />
                  {label}
                </NavLink>
              )
            )}
          </TooltipProvider>
        </nav>

        <div className="border-t border-border">
          <NavLink
            to="/settings"
            data-testid="nav-settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`
            }
          >
            <Gear size={20} weight="duotone" /> Settings
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 glass-header sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Buildings size={18} weight="duotone" className="text-muted-foreground" />
            <span className="font-heading font-bold tracking-tight" data-testid="topbar-business-name">
              {business?.name || "Your Business"}
            </span>
            {business?.service_area && (
              <span className="label-mono hidden sm:inline">{business.service_area}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggle}
              data-testid="theme-toggle"
              className="w-9 h-9 grid place-items-center border border-border hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-border">
              <div className="w-8 h-8 bg-foreground text-background grid place-items-center font-heading font-bold text-sm">
                {(user?.name || user?.email || "U")[0].toUpperCase()}
              </div>
              <button
                onClick={async () => { await logout(); navigate("/login"); }}
                data-testid="logout-btn"
                className="w-9 h-9 grid place-items-center border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
                aria-label="Log out"
              >
                <SignOut size={16} weight="bold" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-[1500px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
