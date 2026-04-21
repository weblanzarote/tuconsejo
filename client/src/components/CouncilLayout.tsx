import { useLocalAuth } from "@/hooks/useLocalAuth";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  Vault,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

const NAV_ITEMS = [
  { href: "/boardroom", label: "Sala de Juntas", icon: Shield },
  { href: "/chat", label: "Mis Asesores", icon: Users },
  { href: "/dashboard", label: "Planes & Seguimiento", icon: LayoutDashboard },
  { href: "/perfil", label: "Mi Perfil", icon: BookOpen },
];

interface CouncilLayoutProps {
  children: React.ReactNode;
}

export default function CouncilLayout({ children }: CouncilLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useLocalAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "CS";

  return (
    <div className="flex h-screen bg-council-gradient overflow-hidden">
      {/* ── Overlay móvil ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed lg:relative z-50 flex flex-col h-full transition-all duration-300 ease-in-out",
          "bg-[oklch(0.10_0.015_260)] border-r border-border",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-border",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🔮</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-display font-semibold text-foreground leading-tight">
                Consejo
              </h1>
              <p className="text-xs text-muted-foreground">Sinérgico</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto hidden lg:flex h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer group",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
                  {!collapsed && (
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Perfil de usuario */}
        <div className={cn(
          "border-t border-border p-3",
          collapsed ? "flex flex-col items-center gap-2" : "space-y-2"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name ?? "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email ?? ""}
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              !collapsed && "w-full justify-start gap-2"
            )}
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Cerrar sesión</span>}
          </Button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-base">🔮</span>
            <span className="text-sm font-display font-semibold">Consejo Sinérgico</span>
          </div>
        </header>

        {/* Área de contenido */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
