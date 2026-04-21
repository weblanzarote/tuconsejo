import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AGENT_COLORS, AGENT_EMOJIS, AGENT_NAMES, MAIN_AGENTS, type AgentId } from "@/lib/agents";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Shield,
  Sparkles,
  TrendingUp,
  Vault,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

// ─── Tarjeta de área por asesor ───────────────────────────────────────────────
function AreaCard({
  agentId,
  items,
  messageCount,
  onClick,
}: {
  agentId: AgentId;
  items: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    deadline?: Date | null;
    metrica?: string | null;
    valorObjetivo?: string | null;
  }>;
  messageCount: number;
  onClick: () => void;
}) {
  const color = AGENT_COLORS[agentId];
  const emoji = AGENT_EMOJIS[agentId];
  const name = AGENT_NAMES[agentId];

  const completed = items.filter((i) => i.status === "completada");
  const inProgress = items.filter((i) => i.status === "en_progreso");
  const pending = items.filter((i) => i.status === "pendiente");
  const total = items.length;
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Próxima acción: primero en progreso, luego pendiente por prioridad
  const priorityOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  const nextItem = inProgress[0] ?? [...pending].sort(
    (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
  )[0];

  const hasActivity = messageCount > 0;
  const isEmpty = total === 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01]",
        isEmpty
          ? "border-border/50 hover:border-border"
          : "border-border hover:border-[var(--c)]"
      )}
      style={{ "--c": `${color}50` } as React.CSSProperties}
    >
      {/* Header: avatar + nombre + mensajes */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
          >
            {emoji}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
            {hasActivity ? (
              <p className="text-xs text-muted-foreground">{messageCount} msgs</p>
            ) : (
              <p className="text-xs text-muted-foreground/50">Sin actividad</p>
            )}
          </div>
        </div>

        {/* % completado o "Iniciar" */}
        {!isEmpty ? (
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold leading-none" style={{ color }}>
              {pct}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completed.length}/{total}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50 group-hover:text-primary transition-colors">
            Iniciar →
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      {!isEmpty && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          {/* Puntos de estado */}
          <div className="flex gap-1 mt-2">
            {inProgress.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${color}15`, color }}
              >
                ⏱ {inProgress.length} en progreso
              </span>
            )}
            {pending.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {pending.length} pendientes
              </span>
            )}
            {completed.length > 0 && completed.length === total && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                ✓ Completado
              </span>
            )}
          </div>
        </div>
      )}

      {/* Próxima acción */}
      {nextItem ? (
        <div
          className="p-2.5 rounded-lg text-left"
          style={{ backgroundColor: `${color}08`, borderLeft: `2px solid ${color}30` }}
        >
          <div className="flex items-start gap-1.5">
            {nextItem.status === "en_progreso" ? (
              <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color }} />
            ) : (
              <Circle className="h-3 w-3 flex-shrink-0 mt-0.5 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-foreground font-medium line-clamp-1 leading-snug">
                {nextItem.title}
              </p>
              {nextItem.metrica && nextItem.valorObjetivo && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {nextItem.metrica} → <span style={{ color }}>{nextItem.valorObjetivo}</span>
                </p>
              )}
              {nextItem.deadline && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(nextItem.deadline).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground/60">
            {isEmpty ? "Consulta a este asesor para crear un plan" : "Plan completado"}
          </p>
        </div>
      )}
    </button>
  );
}

// ─── Resumen global compacto ──────────────────────────────────────────────────
function GlobalProgress({ pct, completed, total, inProgress }: {
  pct: number;
  completed: number;
  total: number;
  inProgress: number;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted">
      {/* Círculo de progreso */}
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-primary transition-all duration-700"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
          {pct}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground mb-1">Progreso global</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {completed} completadas
          </span>
          {inProgress > 0 && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {inProgress} en progreso
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Circle className="h-3 w-3" />
            {total - completed - inProgress} pendientes
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Exportar plan como Markdown (M11) ───────────────────────────────────────
function exportarPlan(
  itemsByAgent: Record<string, Array<{ title: string; status: string; priority: string; description?: string | null; metrica?: string | null; valorObjetivo?: string | null }>>,
  userName: string
) {
  const AGENT_HEADERS: Record<string, string> = {
    economia: "## 💰 Alejandro — Economía & Riqueza",
    carrera: "## 🚀 Valentina — Carrera & Talento",
    salud: "## 💪 Dr. Marcos — Salud & Vitalidad",
    relaciones: "## ❤️ Sofía — Relaciones Íntimas",
    familia: "## 👨‍👩‍👧‍👦 Elena — Círculo & Familia",
    guardian: "## 🔮 El Guardián — Valores & Propósito",
  };

  const STATUS_ICONS: Record<string, string> = {
    completada: "✅",
    en_progreso: "⏱️",
    pendiente: "○",
    cancelada: "❌",
  };

  const date = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  let md = `# Plan de Vida — Consejo Sinérgico\n*${userName} · Exportado el ${date}*\n\n---\n\n`;

  for (const [agentId, items] of Object.entries(itemsByAgent)) {
    if (!items.length) continue;
    md += `${AGENT_HEADERS[agentId] ?? `## ${agentId}`}\n\n`;

    const byStatus = {
      en_progreso: items.filter((i) => i.status === "en_progreso"),
      pendiente: items.filter((i) => i.status === "pendiente"),
      completada: items.filter((i) => i.status === "completada"),
    };

    for (const [status, group] of Object.entries(byStatus)) {
      if (!group.length) continue;
      const label = status === "en_progreso" ? "En progreso" : status === "pendiente" ? "Pendientes" : "Completadas";
      md += `### ${label}\n\n`;
      for (const item of group) {
        const icon = STATUS_ICONS[item.status] ?? "○";
        md += `- ${icon} **${item.title}** *(${item.priority})*\n`;
        if (item.description) md += `  > ${item.description}\n`;
        if (item.metrica) md += `  > Métrica: ${item.metrica} → ${item.valorObjetivo ?? "?"}\n`;
        md += "\n";
      }
    }
    md += "\n";
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plan-consejo-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useLocalAuth();
  const [, navigate] = useLocation();

  const { data: conversations } = trpc.conversations.list.useQuery();
  const { data: actionItems } = trpc.actionPlan.list.useQuery({ agentId: undefined });
  const { data: vaultData } = trpc.vault.get.useQuery();

  // Agrupar items por agentId
  const itemsByAgent = useMemo(() => {
    const map: Record<string, typeof actionItems> = {};
    MAIN_AGENTS.forEach((id) => { map[id] = []; });
    actionItems?.forEach((item) => {
      if (map[item.agentId]) {
        map[item.agentId]!.push(item);
      }
    });
    return map;
  }, [actionItems]);

  // Mensajes por asesor
  const msgByAgent = useMemo(() => {
    const map: Record<string, number> = {};
    conversations?.forEach((c) => { map[c.agentId] = c.messageCount ?? 0; });
    return map;
  }, [conversations]);

  // Stats globales
  const global = useMemo(() => {
    const all = actionItems ?? [];
    const completed = all.filter((i) => i.status === "completada").length;
    const inProgress = all.filter((i) => i.status === "en_progreso").length;
    const total = all.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const areasActivas = MAIN_AGENTS.filter((id) => (itemsByAgent[id]?.length ?? 0) > 0).length;
    return { completed, inProgress, total, pct, areasActivas };
  }, [actionItems, itemsByAgent]);

  // Estado de La Bóveda
  const vaultFields = [
    { key: "personalInfo", label: "Perfil" },
    { key: "financialStatus", label: "Finanzas" },
    { key: "careerData", label: "Carrera" },
    { key: "healthMetrics", label: "Salud" },
    { key: "relationshipStatus", label: "Relaciones" },
    { key: "familyCircle", label: "Familia" },
  ];
  const vaultFilled = vaultFields.filter(
    ({ key }) => vaultData && vaultData[key as keyof typeof vaultData] !== null
  ).length;

  const firstName = user?.name?.split(" ")[0] ?? "Usuario";

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">

      {/* ── Cabecera ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Acciones
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            El estado de todos tus planes activos, área por área.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {global.total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarPlan(itemsByAgent as any, firstName)}
              className="text-muted-foreground text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/perfil")}
            className="text-muted-foreground text-xs"
          >
            <Vault className="mr-1.5 h-3.5 w-3.5" />
            Mi Perfil ({vaultFilled}/{vaultFields.length})
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/boardroom")}
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs"
          >
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Sala de Juntas
          </Button>
        </div>
      </div>

      {/* ── Progreso global (sólo si hay tareas) ── */}
      {global.total > 0 && (
        <GlobalProgress
          pct={global.pct}
          completed={global.completed}
          total={global.total}
          inProgress={global.inProgress}
        />
      )}

      {/* ── 6 tarjetas de área ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Tus 6 Áreas de Vida
          </h2>
          <span className="text-xs text-muted-foreground">
            {global.areasActivas} de 6 con plan activo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MAIN_AGENTS.map((agentId) => (
            <AreaCard
              key={agentId}
              agentId={agentId}
              items={itemsByAgent[agentId] ?? []}
              messageCount={msgByAgent[agentId] ?? 0}
              onClick={() => navigate(`/chat/${agentId}`)}
            />
          ))}
        </div>
      </div>

      {/* ── M7: Próximas Acciones — vista unificada de tareas activas ── */}
      {global.total > 0 && (() => {
        const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 };
        const allActive = (actionItems ?? [])
          .filter((i) => i.status === "pendiente" || i.status === "en_progreso")
          .sort((a, b) => {
            // En progreso primero, luego por prioridad
            if (a.status === "en_progreso" && b.status !== "en_progreso") return -1;
            if (b.status === "en_progreso" && a.status !== "en_progreso") return 1;
            return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
          })
          .slice(0, 12);

        if (!allActive.length) return null;

        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Próximas Acciones
              </h2>
              <span className="text-xs text-muted-foreground">
                {global.inProgress + (actionItems?.filter(i => i.status === "pendiente").length ?? 0)} activas · ordenadas por prioridad
              </span>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              {allActive.map((item, idx) => {
                const color = AGENT_COLORS[item.agentId as AgentId] ?? "#8b5cf6";
                const emoji = AGENT_EMOJIS[item.agentId as AgentId] ?? "🤖";
                const isInProgress = item.status === "en_progreso";
                const priorityColors: Record<string, string> = {
                  alta: "#f43f5e", media: "#f59e0b", baja: "#10b981",
                };
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/chat/${item.agentId}`)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors",
                      idx < allActive.length - 1 && "border-b border-border/50"
                    )}
                  >
                    {/* Icono de estado */}
                    <div className="mt-0.5 flex-shrink-0">
                      {isInProgress
                        ? <Clock className="h-3.5 w-3.5 text-primary" />
                        : <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />}
                    </div>

                    {/* Título + métrica */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{item.title}</p>
                      {item.metrica && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.metrica}
                          {item.valorObjetivo && (
                            <span style={{ color }}> → {item.valorObjetivo}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${priorityColors[item.priority] ?? "#8b5cf6"}15`,
                          color: priorityColors[item.priority] ?? "#8b5cf6",
                        }}
                      >
                        {item.priority}
                      </span>
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${color}20` }}
                        title={AGENT_NAMES[item.agentId as AgentId]}
                      >
                        {emoji}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Footer: acciones rápidas si no hay nada ── */}
      {global.total === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aún no tienes planes de acción. Empieza consultando a tus asesores o plantea un dilema en la Sala de Juntas.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              size="sm"
              onClick={() => navigate("/boardroom")}
              className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Ir a la Sala de Juntas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/chat")}
            >
              Hablar con un asesor
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
