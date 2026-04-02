import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bot,
  Box,
  Cpu,
  Database,
  Key,
  LayoutDashboard,
  RotateCcw,
  Search,
  ServerCog,
  Settings,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";
import { useDesktop } from "@/context/AppContext";
import { ActionButton, Panel, StatusPill, surfaceClasses } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const SIDEBAR_DEFAULT = 264;
const SIDEBAR_MIN = 236;
const SIDEBAR_MAX = 340;
const SIDEBAR_STORAGE_KEY = "modeldock.sidebar-width";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/keys", icon: Key, label: "API Keys" },
  { to: "/models", icon: Box, label: "Models" },
  { to: "/runtime", icon: Cpu, label: "Runtime" },
  { to: "/assistants", icon: Bot, label: "Assistants" },
  { to: "/logs", icon: Database, label: "Logs" },
  { to: "/playground", icon: Terminal, label: "Playground" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { backend, health, restartBackend } = useDesktop();
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!saved) {
      return;
    }

    const parsed = Number(saved);
    if (Number.isFinite(parsed)) {
      setSidebarWidth(Math.min(Math.max(parsed, SIDEBAR_MIN), SIDEBAR_MAX));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      setSidebarWidth(Math.min(Math.max(event.clientX, SIDEBAR_MIN), SIDEBAR_MAX));
    }

    function stopResizing() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [isResizing]);

  const shellStyle = useMemo(
    () => ({ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties),
    [sidebarWidth]
  );

  return (
    <div
      className={cn(
        "flex min-h-screen bg-background text-foreground",
        isResizing ? "cursor-col-resize select-none" : ""
      )}
      style={shellStyle}
    >
      <aside
        className="fixed left-0 top-0 z-40 flex h-screen w-[var(--sidebar-width)] flex-col border-r border-[var(--border-soft)] bg-[var(--surface-shell)] px-4 pb-4 pt-6 shadow-[28px_0_80px_rgba(0,0,0,0.28)]"
      >
        <div>
          <div className="font-headline text-[1.85rem] font-black tracking-[-0.06em] text-primary">
            ModelDock
          </div>
          <div className="font-label mt-1 text-xs text-muted-foreground">
            Local LLM Manager
          </div>
        </div>

        <nav className="mt-7 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-r-2xl px-4 py-3 font-label text-xs font-medium tracking-[0.02em] transition-all",
                  isActive
                    ? "border-r-4 border-primary bg-[rgba(128,120,58,0.12)] text-primary"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--border-soft)] pt-4">
          <Panel variant="muted" className="flex items-center gap-3 rounded-full px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(128,120,58,0.18)] text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-label truncate text-xs font-semibold text-foreground">
                Admin Session
              </p>
              <p className="font-label mt-0.5 text-[10px] text-muted-foreground">
                v{health?.version ?? "0.0.0"}
              </p>
            </div>
            <ActionButton
              variant="ghost"
              className="ml-auto h-9 w-9 rounded-full px-0 py-0"
              icon={RotateCcw}
              onClick={() => void restartBackend()}
              aria-label="Restart backend"
            />
          </Panel>
        </div>

        <button
          type="button"
          aria-label="Resize sidebar"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
          className={cn(
            "absolute right-[-7px] top-0 h-full w-4 cursor-col-resize",
            "after:absolute after:left-1/2 after:top-1/2 after:h-24 after:w-[3px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-[var(--border-soft)] after:transition-all hover:after:bg-primary",
            isResizing ? "after:bg-primary" : ""
          )}
        />
      </aside>

      <main className="ml-[var(--sidebar-width)] flex min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[rgba(18,16,14,0.88)] px-8 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                label="Backend"
                value={backend?.running ? "Ready" : "Offline"}
                online={backend?.running ?? false}
              />
              <StatusPill
                label="Ollama"
                value={health?.ollama.connected ? "Active" : "Unavailable"}
                online={health?.ollama.connected ?? false}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value=""
                  readOnly
                  aria-label="Search coming later"
                  placeholder="Search coming later..."
                  className={cn(
                    surfaceClasses.input,
                    "w-80 bg-[var(--surface-muted)] pl-11 text-xs text-muted-foreground"
                  )}
                />
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <SystemIcon icon={Wifi} label="Network status" />
                <SystemIcon icon={Activity} label="Runtime activity" />
                <SystemIcon icon={ServerCog} label="Backend services" />
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SystemIcon({
  icon: Icon,
  label,
}: {
  icon: typeof Wifi;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)]"
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}
