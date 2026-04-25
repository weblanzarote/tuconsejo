import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { AGENT_COLORS, AGENT_EMOJIS, AGENT_NAMES, CHAT_SELECTOR_AGENTS, CHAT_TABS, type AgentId } from "@/lib/agents";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── Selector de Agente ───────────────────────────────────────────────────────
function AgentSelector({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
      {CHAT_TABS.map((agentId) => {
        const color = AGENT_COLORS[agentId];
        const isSelected = selectedAgent === agentId;
        const label = agentId === "sala_juntas" ? "Todos" : AGENT_NAMES[agentId];
        return (
          <button
            key={agentId}
            onClick={() => onSelect(agentId)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
              isSelected
                ? "text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
            style={
              isSelected
                ? {
                    backgroundColor: `${color}20`,
                    borderColor: `${color}50`,
                    color: color,
                  }
                : {}
            }
          >
            <span>{AGENT_EMOJIS[agentId]}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────
function MessageBubble({
  role,
  content,
  agentId,
  structuredData,
  onSavePlan,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  agentId: AgentId;
  structuredData?: unknown;
  onSavePlan?: (items: ActionItemFromLLM[]) => void;
}) {
  const color = AGENT_COLORS[agentId];
  const emoji = AGENT_EMOJIS[agentId];
  const isUser = role === "user";

  // Limpiar el JSON del contenido para mostrar solo el texto
  const cleanContent = content.replace(/```json[\s\S]*?```/g, "").trim();

  const llmItems = (structuredData as { actionItems?: ActionItemFromLLM[] } | null)?.actionItems;
  const hasItems = llmItems && llmItems.length > 0;

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-1"
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
        >
          {emoji}
        </div>
      )}

      <div className={cn("max-w-[80%] space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="leading-relaxed">{cleanContent}</p>
          ) : (
            <div className="chat-markdown text-foreground">
              <Streamdown>{cleanContent}</Streamdown>
            </div>
          )}
        </div>

        {!isUser && onSavePlan && hasItems && (
          <button
            onClick={() => onSavePlan(llmItems)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-1"
          >
            <Plus className="h-3 w-3" />
            Guardar plan completo ({llmItems.length} acciones)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tipo para action items del LLM ──────────────────────────────────────────
type ActionItemFromLLM = {
  titulo: string;
  descripcion?: string;
  prioridad?: "alta" | "media" | "baja";
  deadline?: string;
  metrica?: string;
  valorObjetivo?: string;
  tipo?: "tarea" | "habito";
};

// ─── Item de Plan de Acción ───────────────────────────────────────────────────
const STATUS_CYCLE: Record<string, "pendiente" | "en_progreso" | "completada"> = {
  pendiente: "en_progreso",
  en_progreso: "completada",
  completada: "pendiente",
  cancelada: "pendiente",
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

function ActionItemCard({
  item,
  onStatusChange,
  onDelete,
}: {
  item: {
    id: number;
    title: string;
    description?: string | null;
    priority: string;
    status: string;
    agentId: string;
    deadline?: Date | null;
    metrica?: string | null;
    valorObjetivo?: string | null;
  };
  onStatusChange: (id: number, status: "pendiente" | "en_progreso" | "completada" | "cancelada") => void;
  onDelete: (id: number) => void;
}) {
  const color = AGENT_COLORS[item.agentId as AgentId] ?? "#8b5cf6";
  const isCompleted = item.status === "completada";
  const isInProgress = item.status === "en_progreso";

  const priorityColors = {
    alta: "#f43f5e",
    media: "#f59e0b",
    baja: "#10b981",
  };

  const nextStatus = STATUS_CYCLE[item.status] ?? "pendiente";

  return (
    <div
      className={cn(
        "p-3 rounded-xl border transition-all",
        isCompleted
          ? "opacity-50 border-border/40"
          : isInProgress
          ? "border-primary/30 bg-primary/5"
          : "border-border hover:border-border/80"
      )}
      style={{ borderLeftColor: isInProgress ? color : color, borderLeftWidth: "3px" }}
    >
      <div className="flex items-start gap-2">
        {/* Botón de estado — cicla al hacer click */}
        <button
          onClick={() => onStatusChange(item.id, nextStatus)}
          title={`Marcar como ${STATUS_LABELS[nextStatus]}`}
          className="mt-0.5 flex-shrink-0 transition-colors"
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : isInProgress ? (
            <Clock className="h-4 w-4 text-primary animate-pulse" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium text-foreground leading-tight",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {item.title}
          </p>

          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}

          {item.metrica && (
            <p className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
              <span className="text-primary/70">Métrica:</span>
              {item.metrica}
              {item.valorObjetivo && (
                <span className="text-primary font-medium">→ {item.valorObjetivo}</span>
              )}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${priorityColors[item.priority as keyof typeof priorityColors] ?? "#8b5cf6"}20`,
                color: priorityColors[item.priority as keyof typeof priorityColors] ?? "#8b5cf6",
              }}
            >
              {item.priority}
            </span>
            {isInProgress && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-primary/10 text-primary">
                en progreso
              </span>
            )}
            {item.deadline && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(item.deadline).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => onDelete(item.id)}
          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Página principal de Chat ─────────────────────────────────────────────────
const VALID_CHAT_AGENTS = new Set<AgentId>(CHAT_SELECTOR_AGENTS);

function parseChatAgentId(raw?: string): AgentId {
  if (raw && VALID_CHAT_AGENTS.has(raw as AgentId)) return raw as AgentId;
  return "economia";
}

export default function Chat() {
  const params = useParams<{ agentId?: string }>();
  const [, navigate] = useLocation();

  // Si la URL es /chat/sala_juntas (o cualquier alias "todos"), redirigimos a /boardroom
  // preservando el ?contexto= si lo hay. Los planes de acción de la Sala de Juntas
  // tienen agentId="sala_juntas" y antes acababan en Alejandro por el fallback.
  useEffect(() => {
    const raw = params.agentId;
    if (raw === "sala_juntas" || raw === "todos") {
      const search = window.location.search;
      navigate(`/boardroom${search}`, { replace: true });
    }
  }, [params.agentId, navigate]);

  const [selectedAgent, setSelectedAgent] = useState<AgentId>(() => parseChatAgentId(params.agentId));
  const contextoParam = new URLSearchParams(window.location.search).get("contexto");
  const [inputValue, setInputValue] = useState(contextoParam ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSelectedAgent(parseChatAgentId(params.agentId));
  }, [params.agentId]);

  const handleSelectTab = (id: AgentId) => {
    if (id === "sala_juntas") {
      navigate("/boardroom");
      return;
    }
    setSelectedAgent(id);
  };
  const [showActionPanel, setShowActionPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: chatData, isLoading: loadingChat } = trpc.conversations.getMessages.useQuery({
    agentId: selectedAgent,
  });

  const { data: actionItems, isLoading: loadingActions } = trpc.actionPlan.list.useQuery({
    agentId: selectedAgent,
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.conversations.getMessages.invalidate({ agentId: selectedAgent });
      utils.actionPlan.list.invalidate({ agentId: selectedAgent });
    },
  });

  const addAction = trpc.actionPlan.add.useMutation({
    onSuccess: () => {
      utils.actionPlan.list.invalidate({ agentId: selectedAgent });
      toast.success("Tarea agregada al Plan de Acción");
    },
  });

  const updateStatus = trpc.actionPlan.updateStatus.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate({ agentId: selectedAgent }),
  });

  const deleteAction = trpc.actionPlan.delete.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate({ agentId: selectedAgent }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || sending) return;
    setInputValue("");
    setSending(true);
    try {
      await sendMessage.mutateAsync({ agentId: selectedAgent, content });
    } catch (e) {
      const msg =
        e instanceof TRPCClientError
          ? e.message
          : "Error al enviar el mensaje. Inténtalo de nuevo.";
      toast.error(msg.length > 320 ? `${msg.slice(0, 317)}…` : msg);
      setInputValue(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSavePlan = async (items: ActionItemFromLLM[]) => {
    for (const item of items) {
      await addAction.mutateAsync({
        agentId: selectedAgent,
        title: item.titulo.slice(0, 512),
        description: item.descripcion,
        priority: item.prioridad ?? "media",
        metrica: item.metrica,
        valorObjetivo: item.valorObjetivo,
        conversationId: chatData?.conversation?.id,
        tipo: item.tipo ?? "tarea",
      });
    }
    toast.success(`${items.length} acciones guardadas en el plan`);
  };

  const handleUpdatePlan = async () => {
    if (sending) return;
    setSending(true);
    try {
      await sendMessage.mutateAsync({
        agentId: selectedAgent,
        content:
          "Por favor revisa mi plan de acción actual y actualízalo con base en nuestra conversación más reciente. Elimina lo que ya no aplique, ajusta plazos y añade acciones nuevas si las hay. Mantén el formato de tabla markdown y genera el JSON con los items actualizados al final.",
      });
    } catch (e) {
      const msg =
        e instanceof TRPCClientError
          ? e.message
          : "Error al solicitar la actualización.";
      toast.error(msg.length > 320 ? `${msg.slice(0, 317)}…` : msg);
    } finally {
      setSending(false);
    }
  };

  const color = AGENT_COLORS[selectedAgent];
  const messages = chatData?.messages ?? [];
  const inProgressItems = actionItems?.filter((i) => i.status === "en_progreso") ?? [];
  const pendingItems = actionItems?.filter((i) => i.status === "pendiente") ?? [];
  const completedItems = actionItems?.filter((i) => i.status === "completada") ?? [];
  const totalActive = inProgressItems.length + pendingItems.length;
  const totalItems = inProgressItems.length + pendingItems.length + completedItems.length;

  // Mientras se procesa el redirect a /boardroom, no renderizamos la UI de Alejandro
  if (params.agentId === "sala_juntas" || params.agentId === "todos") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Selector de agente ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <AgentSelector selectedAgent={selectedAgent} onSelect={handleSelectTab} />
      </div>

      {/* ── Contenido principal dividido ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel izquierdo: Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header del asesor */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-border"
            style={{ borderBottomColor: `${color}30` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${color}20` }}
            >
              {AGENT_EMOJIS[selectedAgent]}
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">
                {AGENT_NAMES[selectedAgent]}
              </h2>
              <p className="text-xs text-muted-foreground">
                {chatData?.conversation?.messageCount ?? 0} mensajes ·{" "}
                {chatData?.conversation?.summary ? "Memoria activa" : "Nueva conversación"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse-glow"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">En línea</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:hidden text-muted-foreground"
                onClick={() => setShowActionPanel(!showActionPanel)}
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", showActionPanel && "rotate-180")} />
              </Button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {loadingChat ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ backgroundColor: `${color}20` }}
                >
                  {AGENT_EMOJIS[selectedAgent]}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Hola, soy {AGENT_NAMES[selectedAgent]}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Estoy aquí para asesorarte en todo lo relacionado con{" "}
                    {selectedAgent === "economia" && "tu economía y riqueza"}
                    {selectedAgent === "carrera" && "tu carrera y talento profesional"}
                    {selectedAgent === "salud" && "tu salud y vitalidad"}
                    {selectedAgent === "relaciones" && "tus relaciones íntimas"}
                    {selectedAgent === "familia" && "tu familia y círculo cercano"}
                    {selectedAgent === "guardian" && "tus valores y propósito de vida"}
                    {selectedAgent === "encuestador" &&
                      "completar tu perfil poco a poco con preguntas breves, sin agobio"}
                    . ¿Por dónde empezamos?
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role as "user" | "assistant"}
                  content={msg.content}
                  agentId={selectedAgent}
                  structuredData={msg.structuredData}
                  onSavePlan={msg.role === "assistant" ? handleSavePlan : undefined}
                />
              ))
            )}

            {sending && (
              <div className="flex gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `${color}20` }}
                >
                  {AGENT_EMOJIS[selectedAgent]}
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pregunta a ${AGENT_NAMES[selectedAgent]}...`}
                disabled={sending}
                className="bg-input border-border flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
                className="bg-primary hover:bg-primary/90 flex-shrink-0"
                style={
                  inputValue.trim()
                    ? { backgroundColor: color, borderColor: color }
                    : {}
                }
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Panel derecho: Plan de Acción */}
        <div
          className={cn(
            "flex flex-col border-l border-border transition-all duration-300",
            showActionPanel ? "w-72 xl:w-80" : "w-0 overflow-hidden",
            "hidden md:flex"
          )}
        >
          {/* Header del panel */}
          <div className="px-4 py-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">Plan de Acción</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => setShowActionPanel(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Stats + botón actualizar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {inProgressItems.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                    {inProgressItems.length} en progreso
                  </span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {totalActive} activas
                </span>
              </div>
              <button
                onClick={handleUpdatePlan}
                disabled={sending || totalItems === 0}
                title="Pedir al asesor que revise y actualice el plan"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" />
                Actualizar
              </button>
            </div>

            {/* Barra de progreso */}
            {totalItems > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{completedItems.length} de {totalItems} completadas</span>
                  <span>{Math.round((completedItems.length / totalItems) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedItems.length / totalItems) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {loadingActions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : totalItems === 0 ? (
              <div className="text-center py-8 px-2">
                <p className="text-xs text-muted-foreground">
                  Cuando el asesor genere un plan, aparecerá aquí. Usa el botón "Guardar plan completo" en los mensajes.
                </p>
              </div>
            ) : (
              <>
                {/* En progreso */}
                {inProgressItems.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-primary px-1">En progreso</p>
                    {inProgressItems.map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        onStatusChange={(id, status) => updateStatus.mutate({ itemId: id, status })}
                        onDelete={(id) => deleteAction.mutate({ itemId: id })}
                      />
                    ))}
                    <div className="gradient-line my-1" />
                  </>
                )}

                {/* Pendientes */}
                {pendingItems.length > 0 && (
                  <>
                    {inProgressItems.length > 0 && (
                      <p className="text-xs text-muted-foreground px-1">Pendientes</p>
                    )}
                    {pendingItems.map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        onStatusChange={(id, status) => updateStatus.mutate({ itemId: id, status })}
                        onDelete={(id) => deleteAction.mutate({ itemId: id })}
                      />
                    ))}
                  </>
                )}

                {/* Completadas */}
                {completedItems.length > 0 && (
                  <>
                    <div className="gradient-line my-2" />
                    <p className="text-xs text-muted-foreground px-1 mb-1">Completadas</p>
                    {completedItems.map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        onStatusChange={(id, status) => updateStatus.mutate({ itemId: id, status })}
                        onDelete={(id) => deleteAction.mutate({ itemId: id })}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
