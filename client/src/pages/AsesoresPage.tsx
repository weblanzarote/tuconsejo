import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { formatYyyyMmDdInTimeZone, getDetectedTimeZone } from "@/lib/dateTz";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MAIN_AGENTS,
  AGENT_NAMES,
  AGENT_DOMAINS,
  AGENT_EMOJIS,
  type AgentId,
} from "@/lib/agents";
import { ChevronDown, ChevronUp, Send, X, BookOpen } from "lucide-react";
import { Link } from "wouter";

// Colores apagados para tema claro
const AGENT_COLORS_LIGHT: Record<AgentId, string> = {
  economia: "#2E7D5E",
  carrera: "#2553A0",
  salud: "#A02525",
  relaciones: "#A02580",
  familia: "#A06B10",
  guardian: "#5E2EA0",
  encuestador: "#0D9488",
  sala_juntas: "#1A7A8A",
};

// Markdown simple sin dependencia extra
function SimpleMarkdown({ text }: { text: string }) {
  // Elimina el bloque JSON de la respuesta si lo hay
  const cleaned = text.replace(/```json[\s\S]*?```/g, "").trim();
  const lines = cleaned.split("\n");
  return (
    <div className="chat-markdown text-sm text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h3 key={i}>{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h3 key={i}>{line.slice(2)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} style={{ listStyle: "disc", marginLeft: "1.25rem" }}>{line.slice(2)}</li>;
        if (line.match(/^\d+\. /))
          return <li key={i} style={{ listStyle: "decimal", marginLeft: "1.25rem" }}>{line.replace(/^\d+\. /, "")}</li>;
        if (line.trim() === "") return <div key={i} style={{ height: "0.5rem" }} />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

interface AdvisorResponseItem {
  agentId: string;
  content: string;
  structuredData: unknown;
  messageId: number;
}

interface SessionMessage {
  userContent: string;
  responses: AdvisorResponseItem[];
  selectedAgents: AgentId[];
}

function extractActionItems(structuredData: unknown): Array<{ title: string; description?: string; priority?: string }> {
  if (!structuredData || typeof structuredData !== "object") return [];
  const data = structuredData as Record<string, unknown>;
  const items = data.actionItems ?? data.action_items ?? data.acciones ?? [];
  if (!Array.isArray(items)) return [];
  return items.slice(0, 2).map((item: unknown) => {
    if (typeof item === "object" && item !== null) {
      const i = item as Record<string, unknown>;
      return {
        title: String(i.title ?? i.titulo ?? i.accion ?? ""),
        description: i.description ? String(i.description) : undefined,
        priority: i.priority ? String(i.priority) : undefined,
      };
    }
    return { title: String(item) };
  }).filter((i) => i.title);
}

export default function AsesoresPage() {
  const { user } = useLocalAuth();
  const [input, setInput] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([]);
  const [predictedAgents, setPredictedAgents] = useState<AgentId[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionMessage[]>([]);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const predictTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Query para hoy (contexto del diario) — misma fecha civil que en /hoy
  const todayStr = formatYyyyMmDdInTimeZone(new Date(), user?.timezone ?? getDetectedTimeZone());
  const { data: todayEntry } = trpc.diary.getEntry.useQuery({ date: todayStr });

  const predict = trpc.advisors.predict.useQuery(
    { content: input },
    { enabled: false }
  );
  const ask = trpc.advisors.ask.useMutation();
  const saveAction = trpc.actionPlan.add.useMutation();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Scroll al fondo cuando llegan respuestas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionHistory]);

  // Predicción de asesores con debounce
  useEffect(() => {
    if (predictTimeout.current) clearTimeout(predictTimeout.current);
    if (input.length < 10) {
      setPredictedAgents([]);
      setSelectedAgents([]);
      return;
    }
    predictTimeout.current = setTimeout(async () => {
      const result = await predict.refetch();
      const ids = (result.data?.suggestedAgentIds ?? []).filter(
        (id): id is AgentId => MAIN_AGENTS.includes(id as AgentId)
      );
      setPredictedAgents(ids);
      setSelectedAgents(ids);
    }, 600);
  }, [input]);

  const toggleAgent = (agentId: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const selectAll = () => setSelectedAgents([...MAIN_AGENTS]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    const agents = selectedAgents.length > 0 ? selectedAgents : predictedAgents.length > 0 ? predictedAgents : ["guardian" as AgentId];

    setIsSending(true);
    try {
      const diaryContext = todayEntry?.content ? todayEntry.content.slice(0, 800) : undefined;
      const result = await ask.mutateAsync({
        content: trimmed,
        agentIds: agents as ("economia" | "carrera" | "salud" | "relaciones" | "familia" | "guardian")[],
        diaryContext,
      });

      const msg: SessionMessage = {
        userContent: trimmed,
        responses: result.responses as AdvisorResponseItem[],
        selectedAgents: agents,
      };
      setSessionHistory((prev) => [...prev, msg]);

      // Expandir todas las respuestas de este mensaje
      const key = `${sessionHistory.length}`;
      setExpandedResponses((prev) => {
        const next = new Set(prev);
        agents.forEach((_, i) => next.add(`${key}-${i}`));
        return next;
      });

      setInput("");
      setPredictedAgents([]);
      setSelectedAgents([]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveAction = async (
    agentId: AgentId,
    item: { title: string; description?: string; priority?: string }
  ) => {
    await saveAction.mutateAsync({
      agentId,
      title: item.title,
      description: item.description,
      priority: (item.priority as "alta" | "media" | "baja") ?? "media",
    });
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-6">
      {/* ── Cabecera ── */}
      <div className="py-8 pb-4">
        <h1 className="text-xl font-semibold text-foreground">Asesores</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Consulta a tus asesores. La IA seleccionará los más relevantes para tu pregunta.
        </p>
      </div>

      {/* ── Historial de sesión ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-4">
        {sessionHistory.length === 0 && (
          <div className="py-12 text-center space-y-2">
            <p className="text-muted-foreground text-sm">¿En qué puedo ayudarte hoy?</p>
            {todayEntry?.content && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-start gap-2 text-left">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Contexto del diario:</span> Tus asesores tienen acceso a lo que escribiste hoy para darte una respuesta más personalizada.
                </div>
              </div>
            )}
          </div>
        )}

        {sessionHistory.map((msg, msgIdx) => (
          <div key={msgIdx} className="space-y-4 animate-fade-in-up">
            {/* Pregunta del usuario */}
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-primary/80 backdrop-blur-md text-primary-foreground border border-white/10 shadow-lg text-sm px-4 py-3 rounded-2xl rounded-tr-sm">
                {msg.userContent}
              </div>
            </div>

            {/* Respuestas de asesores */}
            <div className="space-y-4">
              {msg.responses.map((resp, respIdx) => {
                const agentId = resp.agentId as AgentId;
                const color = AGENT_COLORS_LIGHT[agentId] ?? "#3D3D3A";
                const expandKey = `${msgIdx}-${respIdx}`;
                const isExpanded = expandedResponses.has(expandKey);
                const actionItems = extractActionItems(resp.structuredData);

                return (
                  <div key={respIdx} className="glass-surface rounded-xl overflow-hidden shadow-lg transition-all duration-300">
                    {/* Cabecera del asesor */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(expandKey)}
                    >
                      <img 
                        src={`/assets/advisor-${agentId}.webp`} 
                        alt={AGENT_NAMES[agentId]} 
                        className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-md flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-base font-semibold tracking-wide" style={{ color: "#FFF" }}>{AGENT_NAMES[agentId]}</span>
                        <span className="text-xs text-muted-foreground ml-2 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/5">{AGENT_DOMAINS[agentId]}</span>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="h-5 w-5 text-white/50 flex-shrink-0" />
                        : <ChevronDown className="h-5 w-5 text-white/50 flex-shrink-0" />
                      }
                    </button>

                    {/* Respuesta */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
                        <div className="pt-3">
                          <SimpleMarkdown text={resp.content} />
                        </div>

                        {/* Action items */}
                        {actionItems.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acciones sugeridas</p>
                            {actionItems.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-start gap-3 p-3 bg-black/40 backdrop-blur-sm rounded-lg border border-white/5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleSaveAction(agentId, item)}
                                  className="text-xs text-muted-foreground border border-white/20 bg-white/5 hover:bg-primary/20 hover:text-white px-3 py-1.5 rounded-md cursor-pointer transition-colors flex-shrink-0 shadow-sm"
                                >
                                  Guardar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Lucía — perfil progresivo (chat 1:1, no entra en consultas múltiples) */}
      <div className="pb-2">
        <Link
          href="/chat/encuestador"
          className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <span className="text-xl flex-shrink-0" aria-hidden>📋</span>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-foreground">Lucía — Encuestadora</p>
            <p className="text-xs text-muted-foreground">
              Mini-cuestionarios opcionales para ir rellenando tu perfil con calma. Cuantos más datos compartas (cuando quieras), mejor te orientarán los demás asesores.
            </p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">Abrir chat →</span>
        </Link>
      </div>

      {/* ── Input area ── */}
      <div className="py-4 border-t border-border space-y-3">
        {/* Vista previa de asesores seleccionados */}
        {(selectedAgents.length > 0 || predictedAgents.length > 0) && input.length >= 10 && (
          <div className="flex items-center gap-2 flex-wrap animate-fade-in">
            <span className="text-xs text-muted-foreground">Responderán:</span>
            {selectedAgents.map((id) => {
              const color = AGENT_COLORS_LIGHT[id];
              return (
                <button
                  key={id}
                  onClick={() => toggleAgent(id)}
                  className="flex items-center gap-1.5 text-xs pr-2 pl-0.5 py-0.5 rounded-full border border-white/20 bg-black/50 backdrop-blur-md cursor-pointer transition-all hover:bg-black/80"
                  style={{ color: "#FFF" }}
                >
                  <img src={`/assets/advisor-${id}.webp`} alt={id} className="w-5 h-5 rounded-full object-cover border border-white/10" />
                  <span className="font-medium tracking-wide">{AGENT_NAMES[id]}</span>
                  <X className="h-3 w-3 ml-0.5 text-white/50" />
                </button>
              );
            })}
            {/* Añadir asesores no seleccionados */}
            {MAIN_AGENTS.filter((id) => !selectedAgents.includes(id)).map((id) => (
              <button
                key={id}
                onClick={() => toggleAgent(id)}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground cursor-pointer hover:border-foreground/30 transition-colors"
              >
                {AGENT_EMOJIS[id]} <span>+</span>
              </button>
            ))}
            <button
              onClick={selectAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2 ml-1"
            >
              Todos
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta... (Enter para enviar, Shift+Enter para salto de línea)"
            disabled={isSending}
            className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none min-h-[44px] max-h-[200px] focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50 disabled:opacity-60"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-lg transition-colors cursor-pointer",
              input.trim() && !isSending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isSending
              ? "Consultando asesores..."
              : "Los asesores también tienen en cuenta tu diario de hoy."
            }
          </p>
          <div className="flex items-center gap-3">
            <Link href="/notas">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                Notas →
              </span>
            </Link>
            <Link href="/perfil">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                Mi Perfil →
              </span>
            </Link>
            <Link href="/boardroom">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                Sala de Juntas →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
