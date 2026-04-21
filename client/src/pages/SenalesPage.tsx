import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Mail,
  Check,
  X,
  Send,
  Plus,
  ExternalLink,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

// ─── Utilidades ───────────────────────────────────────────────────────────────
function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1) return "Hace menos de 1h";
  if (diffH < 24) return `Hace ${diffH}h`;
  if (diffD === 1) return "Ayer";
  if (diffD < 7) return `Hace ${diffD} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function containsDateTime(text: string): boolean {
  return /(\d{1,2}[:\h]\d{2}|\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i.test(
    text
  );
}

// ─── Componente: Drawer de Respuesta ─────────────────────────────────────────
interface ReplyDrawerProps {
  signal: {
    id: number;
    subject: string;
    fromName: string;
    fromAddress: string;
    snippet: string;
    draftReply?: string | null;
  };
  onClose: () => void;
  onSent: () => void;
}

function ReplyDrawer({ signal, onClose, onSent }: ReplyDrawerProps) {
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(signal.draftReply ?? "");

  const draftMutation = trpc.signals.draftReply.useMutation({
    onSuccess: (data) => setDraft(data.draft),
    onError: () => toast.error("No se pudo generar el borrador"),
  });
  const sendMutation = trpc.signals.sendReply.useMutation({
    onSuccess: () => {
      toast.success("Respuesta enviada");
      onSent();
    },
    onError: () => toast.error("No se pudo enviar la respuesta"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Re: {signal.subject}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Para {signal.fromName || signal.fromAddress}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Email original (snippet) */}
          <div className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 line-clamp-2">
            {signal.snippet}
          </div>

          {/* Instrucción */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              ¿Cómo quieres responder?
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='Ej: "de acuerdo", "no me interesa", "pídele más información"'
              rows={2}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Botón generar */}
          <button
            onClick={() =>
              draftMutation.mutate({ id: signal.id, instruction: instruction.trim() || "responde de forma amable" })
            }
            disabled={draftMutation.isPending}
            className={cn(
              "flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors cursor-pointer",
              draftMutation.isPending
                ? "border-border text-muted-foreground cursor-not-allowed"
                : "border-foreground/20 text-foreground hover:bg-muted"
            )}
          >
            {draftMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {draftMutation.isPending ? "Generando..." : "Generar borrador"}
          </button>

          {/* Borrador */}
          {draft && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Borrador</label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/30 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => sendMutation.mutate({ id: signal.id, draft })}
            disabled={!draft || sendMutation.isPending}
            className={cn(
              "flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
              draft && !sendMutation.isPending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {sendMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar respuesta
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: Drawer Convertir en Tarea ────────────────────────────────────
interface ConvertDrawerProps {
  signal: {
    id: number;
    subject: string;
    fromName: string;
    snippet: string;
    fullBody?: string | null;
  };
  onClose: () => void;
  onConverted: () => void;
}

function ConvertDrawer({ signal, onClose, onConverted }: ConvertDrawerProps) {
  const [title, setTitle] = useState(signal.subject);
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");
  const [deadline, setDeadline] = useState("");
  const [createEvent, setCreateEvent] = useState(false);
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");

  const hasDateTime = containsDateTime(
    (signal.fullBody ?? signal.snippet).slice(0, 1000)
  );

  const convertMutation = trpc.signals.convertToTask.useMutation();
  const calendarMutation = trpc.signals.createCalendarEvent.useMutation();
  const utils = trpc.useUtils();

  const handleSave = async () => {
    try {
      const result = await convertMutation.mutateAsync({
        id: signal.id,
        title: title.trim() || signal.subject,
        priority,
        deadline: deadline || undefined,
      });

      if (createEvent && eventStart && eventEnd) {
        await calendarMutation.mutateAsync({
          title: title.trim() || signal.subject,
          startDatetime: eventStart,
          endDatetime: eventEnd,
          signalId: signal.id,
        });
      }

      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      await utils.actionPlan.list.invalidate();
      toast.success("Tarea creada");
      onConverted();
    } catch {
      toast.error("No se pudo crear la tarea");
    }
  };

  const isPending = convertMutation.isPending || calendarMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Convertir en tarea</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          {/* Prioridad */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
            <div className="flex gap-2">
              {(["alta", "media", "baja"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-colors cursor-pointer capitalize",
                    priority === p
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha límite */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fecha límite (opcional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          {/* Opción de crear evento en calendario */}
          {hasDateTime && (
            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createEvent}
                  onChange={(e) => setCreateEvent(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Crear también evento en Google Calendar</span>
              </label>
              {createEvent && (
                <div className="space-y-2 pl-5">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Inicio</label>
                    <input
                      type="datetime-local"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fin</label>
                    <input
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
              !isPending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Guardar tarea
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: Signal Card ───────────────────────────────────────────────────
interface SignalCardProps {
  signal: {
    id: number;
    subject: string;
    fromName: string;
    fromAddress: string;
    snippet: string;
    fullBody?: string | null;
    receivedAt?: Date | null;
    draftReply?: string | null;
  };
  onIgnored: () => void;
  onReplied: () => void;
  onConverted: () => void;
}

function SignalCard({ signal, onIgnored, onReplied, onConverted }: SignalCardProps) {
  const [showReplyDrawer, setShowReplyDrawer] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);

  const utils = trpc.useUtils();
  const ignoreMutation = trpc.signals.ignore.useMutation({
    onSuccess: async () => {
      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      onIgnored();
    },
    onError: () => toast.error("No se pudo ignorar"),
  });

  return (
    <>
      <div className="border border-border rounded-xl p-4 space-y-3 bg-background hover:border-foreground/20 transition-colors">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{signal.subject}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {signal.fromName || signal.fromAddress}
              {signal.fromName && signal.fromAddress !== signal.fromName && (
                <span className="ml-1 opacity-60">&lt;{signal.fromAddress}&gt;</span>
              )}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeDate(signal.receivedAt)}
          </span>
        </div>

        {/* Snippet */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {signal.snippet}
        </p>

        {/* Acciones */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setShowReplyDrawer(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            Responder
          </button>
          <button
            onClick={() => setShowConvertDrawer(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            Tarea
          </button>
          <button
            onClick={() => ignoreMutation.mutate({ id: signal.id })}
            disabled={ignoreMutation.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-auto"
            title="Ignorar"
          >
            <X className="h-3 w-3" />
            Ignorar
          </button>
        </div>
      </div>

      {showReplyDrawer && (
        <ReplyDrawer
          signal={signal}
          onClose={() => setShowReplyDrawer(false)}
          onSent={async () => {
            setShowReplyDrawer(false);
            await utils.signals.list.invalidate();
            await utils.signals.pendingCount.invalidate();
            onReplied();
          }}
        />
      )}

      {showConvertDrawer && (
        <ConvertDrawer
          signal={signal}
          onClose={() => setShowConvertDrawer(false)}
          onConverted={() => {
            setShowConvertDrawer(false);
            onConverted();
          }}
        />
      )}
    </>
  );
}

// ─── Página principal: Señales ────────────────────────────────────────────────
export default function SenalesPage() {
  const utils = trpc.useUtils();
  const { data: googleStatus, isLoading: statusLoading } = trpc.signals.googleStatus.useQuery();
  const { data: signals, isLoading: signalsLoading } = trpc.signals.list.useQuery(
    { status: "pending" },
    { enabled: googleStatus?.connected === true }
  );
  const syncMutation = trpc.signals.sync.useMutation({
    onSuccess: async (data) => {
      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      if (data.newSignals > 0) {
        toast.success(`${data.newSignals} señal${data.newSignals > 1 ? "es" : ""} nueva${data.newSignals > 1 ? "s" : ""}`);
      } else {
        toast("Sin novedades en el correo");
      }
    },
    onError: () => toast.error("No se pudo sincronizar el correo"),
  });

  const pendingSignals = signals ?? [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Señales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Emails que requieren tu atención
          </p>
        </div>
        {googleStatus?.connected && (
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={cn(
              "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border transition-colors cursor-pointer",
              syncMutation.isPending
                ? "text-muted-foreground cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:border-foreground/20"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            {syncMutation.isPending ? "Sincronizando..." : "Actualizar"}
          </button>
        )}
      </div>

      {/* Banner de conexión */}
      {!statusLoading && !googleStatus?.connected && (
        <div className="border border-border rounded-xl p-6 space-y-4 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Conecta tu Gmail</p>
            <p className="text-sm text-muted-foreground">
              Conecta tu cuenta para que la app filtre tus emails y muestre solo lo que importa.
            </p>
          </div>
          <a
            href="/api/auth/google"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Conectar Gmail
          </a>
        </div>
      )}

      {/* Email conectado — info */}
      {googleStatus?.connected && googleStatus.email && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Conectado como {googleStatus.email}</span>
          <a
            href="/api/auth/google/disconnect"
            onClick={async (e) => {
              e.preventDefault();
              await fetch("/api/auth/google/disconnect", { method: "POST" });
              utils.signals.googleStatus.invalidate();
            }}
            className="hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
          >
            Desconectar
          </a>
        </div>
      )}

      {/* Lista de señales */}
      {googleStatus?.connected && (
        <>
          {signalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-xl p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : pendingSignals.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Check className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Sin señales pendientes</p>
              <p className="text-xs text-muted-foreground/60">
                Pulsa "Actualizar" para revisar tu correo
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal as any}
                  onIgnored={() => utils.signals.list.invalidate()}
                  onReplied={() => utils.signals.list.invalidate()}
                  onConverted={() => utils.signals.list.invalidate()}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
