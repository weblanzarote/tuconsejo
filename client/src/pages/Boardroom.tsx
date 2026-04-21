import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { AGENT_COLORS, AGENT_NAMES, type AgentId } from "@/lib/agents";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const SUGGESTED_QUERIES = [
  "¿Debería aceptar una oferta de trabajo en el extranjero con un 40% más de salario?",
  "¿Es el momento adecuado para tener un hijo dado mi situación actual?",
  "¿Debería dejar mi trabajo estable para emprender mi propio negocio?",
  "¿Cómo equilibro mi ambición profesional con mi vida familiar?",
  "¿Debería invertir mis ahorros en bienes raíces o en bolsa?",
];

const ADVISORS = [
  { emoji: "💰", name: "Alejandro", id: "economia" as AgentId },
  { emoji: "🚀", name: "Valentina", id: "carrera" as AgentId },
  { emoji: "💪", name: "Dr. Marcos", id: "salud" as AgentId },
  { emoji: "❤️", name: "Sofía", id: "relaciones" as AgentId },
  { emoji: "👨‍👩‍👧‍👦", name: "Elena", id: "familia" as AgentId },
  { emoji: "🔮", name: "El Guardián", id: "guardian" as AgentId },
];

interface DebateResult {
  perspectivas?: Array<{ asesor: string; emoji: string; posicion: string }>;
  conflictos?: string[];
  consenso?: string;
  actionItems?: Array<{
    titulo: string;
    descripcion?: string;
    asesor?: string;
    prioridad?: string;
    deadline?: string;
    metrica?: string;
    valorObjetivo?: string;
  }>;
}

// ─── Tarjeta de debate con reveal animado ─────────────────────────────────────
function DebateCard({
  result,
  onSaveItems,
  animate,
}: {
  result: DebateResult;
  onSaveItems?: () => void;
  animate?: boolean;
}) {
  const perspectivas = result.perspectivas ?? [];
  // Si animate=true, empieza en 0 y revela de a uno. Si no, muestra todo.
  const [revealCount, setRevealCount] = useState(animate ? 0 : perspectivas.length);

  useEffect(() => {
    if (!animate || revealCount >= perspectivas.length) return;
    const t = setTimeout(() => setRevealCount((c) => c + 1), 700);
    return () => clearTimeout(t);
  }, [animate, revealCount, perspectivas.length]);

  const visiblePerspectivas = perspectivas.slice(0, revealCount);
  // Mostrar conflictos/consenso/actions sólo cuando ya se mostraron todas las perspectivas
  const showRest = !animate || revealCount >= perspectivas.length;

  return (
    <div className="space-y-4 mt-4">
      {/* Perspectivas — aparecen secuencialmente */}
      {perspectivas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Posiciones del Consejo
          </h4>
          <div className="space-y-2">
            {visiblePerspectivas.map((p, i) => {
              const agentId = Object.entries(AGENT_NAMES).find(([, name]) => name === p.asesor)?.[0] as AgentId | undefined;
              const color = agentId ? AGENT_COLORS[agentId] : "#8b5cf6";
              return (
                <div
                  key={i}
                  className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  {/* Avatar del asesor */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
                  >
                    {p.emoji}
                  </div>
                  {/* Burbuja de diálogo */}
                  <div
                    className="flex-1 rounded-2xl rounded-tl-sm px-3 py-2.5"
                    style={{ backgroundColor: `${color}0d`, borderLeft: `2px solid ${color}40` }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color }}>
                      {p.asesor}
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{p.posicion}</p>
                  </div>
                </div>
              );
            })}

            {/* Indicador "esperando al siguiente asesor" */}
            {animate && revealCount < perspectivas.length && (
              <div className="flex gap-3 items-center">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: `${AGENT_COLORS[ADVISORS[revealCount]?.id ?? "guardian"]}20` }}
                >
                  {ADVISORS[revealCount]?.emoji}
                </div>
                <div className="flex gap-1.5 items-center px-3 py-2 rounded-2xl bg-muted/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRest && (
        <>
          {/* Conflictos */}
          {result.conflictos && result.conflictos.length > 0 && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-in fade-in duration-500">
              <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Tensiones identificadas
              </h4>
              <ul className="space-y-1">
                {result.conflictos.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-amber-400 flex-shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Consenso */}
          {result.consenso && (
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 animate-in fade-in duration-500">
              <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Consenso del Consejo
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{result.consenso}</p>
            </div>
          )}

          {/* Action Items */}
          {result.actionItems && result.actionItems.length > 0 && (
            <div className="space-y-2 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Plan de Acción Colectivo
                </h4>
                {onSaveItems && (
                  <button
                    onClick={onSaveItems}
                    className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Guardar {result.actionItems.length} acciones
                  </button>
                )}
              </div>
              {result.actionItems.map((item, i) => {
                const agentId = Object.entries(AGENT_NAMES).find(([, name]) => name === item.asesor)?.[0] as AgentId | undefined;
                const color = agentId ? AGENT_COLORS[agentId] : "#8b5cf6";
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border-l-2"
                    style={{ borderLeftColor: color }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                      {item.descripcion && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.descripcion}</p>
                      )}
                      {item.metrica && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex gap-1 flex-wrap">
                          <span className="text-primary/70">Métrica:</span>
                          {item.metrica}
                          {item.valorObjetivo && (
                            <span className="text-primary font-medium">→ {item.valorObjetivo}</span>
                          )}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {item.asesor && (
                          <span className="text-xs text-muted-foreground">{item.asesor}</span>
                        )}
                        {item.prioridad && (
                          <span className="text-xs text-primary">{item.prioridad}</span>
                        )}
                        {item.deadline && (
                          <span className="text-xs text-muted-foreground">📅 {item.deadline}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Mensaje del boardroom ────────────────────────────────────────────────────
function BoardroomMessage({
  role,
  content,
  structuredData,
  onSaveItems,
  animate,
}: {
  role: "user" | "assistant";
  content: string;
  structuredData?: unknown;
  onSaveItems?: () => void;
  animate?: boolean;
}) {
  const cleanContent = content.replace(/```json[\s\S]*?```/g, "").trim();
  const result = structuredData as DebateResult | null;

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <span className="text-xs font-semibold text-primary">Sala de Juntas</span>
        <div className="flex gap-1">
          {ADVISORS.map((a) => (
            <span key={a.id} className="text-sm">{a.emoji}</span>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        {/* Sólo mostramos el bloque de texto si no hay perspectivas que mostrar primero */}
        {(!result?.perspectivas?.length || !animate) && cleanContent && (
          <div className="chat-markdown text-foreground text-sm">
            <Streamdown>{cleanContent}</Streamdown>
          </div>
        )}
        {result && (result.perspectivas || result.conflictos || result.consenso || result.actionItems) && (
          <DebateCard result={result} onSaveItems={onSaveItems} animate={animate} />
        )}
      </div>
    </div>
  );
}

// ─── Animación de carga: "Alejandro está analizando..." ───────────────────────
function DebatingIndicator({ label }: { label?: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((i) => (i + 1) % ADVISORS.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const active = ADVISORS[activeIdx];
  const color = AGENT_COLORS[active.id];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary animate-pulse" />
        </div>
        <span className="text-xs text-primary">{label ?? "El Consejo está deliberando..."}</span>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        {/* Fila de avatares con el activo resaltado */}
        <div className="flex gap-2 items-center">
          {ADVISORS.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all duration-500",
                i === activeIdx ? "scale-125" : "opacity-30 scale-100"
              )}
              style={{
                backgroundColor: i === activeIdx ? `${AGENT_COLORS[a.id]}25` : "transparent",
                border: i === activeIdx ? `1px solid ${AGENT_COLORS[a.id]}50` : "1px solid transparent",
              }}
            >
              {a.emoji}
            </div>
          ))}
        </div>

        {/* Indicador textual del asesor activo */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-muted-foreground transition-all">
            {active.emoji} <span style={{ color }}>{active.name}</span> está analizando tu consulta...
          </span>
        </div>

        {/* Typing dots */}
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ─── Página principal de Sala de Juntas ───────────────────────────────────────
export default function Boardroom() {
  const [query, setQuery] = useState("");
  const [debating, setDebating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [animatingMsgId, setAnimatingMsgId] = useState<number | null>(null);
  const prevMsgCount = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: historyData, isLoading: loadingHistory } = trpc.boardroom.getHistory.useQuery();
  const debate = trpc.boardroom.debate.useMutation({
    onSuccess: async () => {
      await utils.boardroom.getHistory.invalidate();
      await utils.boardroom.getHistory.refetch();
    },
  });
  const checkin = trpc.boardroom.checkin.useMutation({
    onSuccess: async () => {
      await utils.boardroom.getHistory.invalidate();
      await utils.boardroom.getHistory.refetch();
    },
  });

  const addAction = trpc.actionPlan.add.useMutation({
    onSuccess: () => toast.success("Tarea agregada al Plan de Acción"),
  });

  const handleCheckin = async () => {
    if (checkingIn || debating) return;
    setCheckingIn(true);
    try {
      await checkin.mutateAsync();
    } catch (e) {
      toast.error("Error al iniciar el check-in. Inténtalo de nuevo.");
    } finally {
      setCheckingIn(false);
    }
  };

  // Detectar qué mensaje es nuevo para animarlo
  useEffect(() => {
    const msgs = historyData?.messages ?? [];
    const prevCount = prevMsgCount.current;

    if (msgs.length > prevCount && prevCount > 0) {
      // Hay un mensaje nuevo (no carga inicial) — animar el último assistant
      const lastMsg = [...msgs].reverse().find((m) => m.role === "assistant");
      if (lastMsg) setAnimatingMsgId(lastMsg.id);
    }
    prevMsgCount.current = msgs.length;
  }, [historyData?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyData?.messages, debating]);

  const handleDebate = async (q?: string) => {
    const queryText = q ?? query.trim();
    if (!queryText || debating) return;
    setQuery("");
    setDebating(true);
    try {
      await debate.mutateAsync({ query: queryText });
    } catch (e) {
      const msg =
        e instanceof TRPCClientError
          ? e.message
          : "Error al iniciar el debate. Inténtalo de nuevo.";
      toast.error(msg.length > 320 ? `${msg.slice(0, 317)}…` : msg);
    } finally {
      setDebating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleDebate();
    }
  };

  const messages = historyData?.messages ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 md:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">Sala de Juntas</h1>
            <p className="text-xs text-muted-foreground">
              Todos tus asesores debaten juntos tu consulta más compleja
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckin}
              disabled={checkingIn || debating}
              className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
            >
              {checkingIn ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              )}
              Check-in semanal
            </Button>
            <div className="hidden sm:flex gap-1">
              {ADVISORS.map((a) => (
                <div
                  key={a.id}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm"
                >
                  {a.emoji}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mensajes ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar max-w-4xl mx-auto w-full">
        {loadingHistory ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-6">
            {/* Intro */}
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">
                Convoca a tu Consejo
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Plantea tu dilema más complejo y todos tus asesores debatirán desde sus
                perspectivas únicas para darte una visión 360°.
              </p>
            </div>

            {/* Preguntas sugeridas */}
            <div>
              <p className="text-xs text-muted-foreground mb-3 text-center">Preguntas frecuentes</p>
              <div className="space-y-2">
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleDebate(q)}
                    className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-primary mr-2">→</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const sd = msg.structuredData as {
              actionItems?: Array<{
                titulo: string;
                descripcion?: string;
                asesor?: string;
                prioridad?: "alta" | "media" | "baja";
                deadline?: string;
                metrica?: string;
                valorObjetivo?: string;
              }>;
            } | null;
            const handleSaveItems = sd?.actionItems?.length
              ? async () => {
                  for (const item of sd.actionItems!) {
                    await addAction.mutateAsync({
                      agentId: "sala_juntas",
                      title: item.titulo.slice(0, 512),
                      description: item.descripcion,
                      priority: item.prioridad ?? "media",
                      metrica: item.metrica,
                      valorObjetivo: item.valorObjetivo,
                    });
                  }
                  toast.success(`${sd.actionItems!.length} acciones guardadas en el plan`);
                }
              : undefined;
            return (
              <BoardroomMessage
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                structuredData={msg.structuredData}
                onSaveItems={handleSaveItems}
                animate={msg.id === animatingMsgId}
              />
            );
          })
        )}

        {/* Animación de carga */}
        {(debating || checkingIn) && (
          <DebatingIndicator label={checkingIn ? "Revisando tus planes activos..." : "El Consejo está deliberando..."} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="p-4 md:p-6 border-t border-border max-w-4xl mx-auto w-full">
        <div className="flex gap-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Plantea tu dilema al Consejo... (Enter para enviar)"
            disabled={debating}
            className="bg-input border-border resize-none min-h-[60px] max-h-32"
            rows={2}
          />
          <Button
            onClick={() => handleDebate()}
            disabled={!query.trim() || debating}
            className="bg-primary hover:bg-primary/90 flex-shrink-0 self-end"
          >
            {debating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Todos los asesores analizarán tu consulta y debatirán para darte una perspectiva completa
        </p>
      </div>
    </div>
  );
}
