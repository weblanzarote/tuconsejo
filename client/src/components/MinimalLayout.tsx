import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Mail,
  Menu,
  Users,
  X,
  LogOut,
  FileText,
  ChevronRight,
  Download,
  Wallet,
  Sun,
  Moon,
  MessageCircle,
  MessageCircleOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import CommandPalette from "./CommandPalette";
import ChatFab, { readChatFabVisible, setChatFabVisible } from "./ChatFab";

const NAV_ITEMS = [
  { href: "/hoy", label: "Hoy", icon: BookOpen },
  { href: "/correos", label: "Correos", icon: Mail },
  { href: "/asesores", label: "Asesores", icon: Users },
  { href: "/apuntes", label: "Apuntes", icon: FileText },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];

interface MinimalLayoutProps {
  children: React.ReactNode;
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useLocalAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const { data: pendingData } = trpc.signals.pendingCount.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: false,
  });
  const pendingCount = pendingData?.count ?? 0;

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const [fabVisible, setFabVisibleState] = useState<boolean>(() => readChatFabVisible());
  useEffect(() => {
    const handler = (e: Event) => {
      setFabVisibleState(Boolean((e as CustomEvent<boolean>).detail));
    };
    window.addEventListener("tuconsejo.chatFab.visibility", handler);
    return () => window.removeEventListener("tuconsejo.chatFab.visibility", handler);
  }, []);
  const toggleFab = () => setChatFabVisible(!fabVisible);

  return (
    <div className="flex h-screen bg-transparent overflow-hidden text-foreground">
      <CommandPalette />
      {/* ── Overlay móvil ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed lg:relative z-50 flex flex-col h-full",
          "backdrop-blur-xl border-r border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "w-52 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs leading-none">✦</span>
          </div>
          <span className="text-sm font-medium text-foreground tracking-tight drop-shadow-sm">Consejo</span>
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            const showBadge = item.href === "/correos" && pendingCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors duration-100 cursor-pointer",
                    "text-sm",
                    isActive
                      ? "bg-accent text-foreground font-medium border-l-2 border-foreground rounded-l-none pl-[10px]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-foreground text-background text-[10px] font-medium flex items-center justify-center">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Perfil */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Modo claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Modo oscuro</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={toggleFab}
            className="flex items-center gap-2 px-3 py-1.5 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            aria-pressed={fabVisible}
          >
            {fabVisible ? (
              <>
                <MessageCircleOff className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Ocultar chat flotante</span>
              </>
            ) : (
              <>
                <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Mostrar chat flotante</span>
              </>
            )}
          </button>
          <button
            onClick={() => { navigate("/perfil"); setMobileOpen(false); }}
            className="flex items-center gap-2.5 px-3 py-1.5 min-w-0 w-full rounded-md hover:bg-accent/60 transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-muted-foreground">{initials}</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium text-foreground truncate">{user?.name ?? "Usuario"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.username ?? ""}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
          </button>
          {canInstall && !isInstalled && (
            <button
              onClick={() => void install()}
              className="flex items-center gap-2 px-3 py-1.5 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Instalar app</span>
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 w-full rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header móvil */}
        <header 
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-black/10 dark:border-white/10 backdrop-blur-xl border-x-0 border-t-0 rounded-none shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{ backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <span className="text-sm font-medium text-foreground">
            {NAV_ITEMS.find(n => location.startsWith(n.href))?.label ?? "Perfil"}
          </span>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
        <ChatFab />
      </div>
    </div>
  );
}
