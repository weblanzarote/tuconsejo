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
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
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
  return /(\d{1,2}[:\h]\d{2}|\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i.test(text);
}

// ─── Drawer de Respuesta ──────────────────────────────────────────────────────
function ReplyDrawer({ signal, onClose, onSent }: {
  signal: { id: number; subject: string; fromName: string; fromAddress: string; snippet: string; draftReply?: string | null };
  onClose: () => void;
  onSent: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(signal.draftReply ?? "");

  const draftMutation = trpc.signals.draftReply.useMutation({
    onSuccess: (data) => setDraft(data.draft),
    onError: () => toast.error("No se pudo generar el borrador"),
  });
  const sendMutation = trpc.signals.sendReply.useMutation({
    onSuccess: () => { toast.success("Respuesta enviada"); onSent(); },
    onError: () => toast.error("No se pudo enviar la respuesta"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Re: {signal.subject}</p>
            <p className="text-xs text-muted-foreground truncate">Para {signal.fromName || signal.fromAddress}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 ml-3 p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 line-clamp-2">{signal.snippet}</div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">¿Cómo quieres responder?</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='Ej: "de acuerdo", "no me interesa", "pídele más información"'
              rows={2}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            onClick={() => draftMutation.mutate({ id: signal.id, instruction: instruction.trim() || "responde de forma amable" })}
            disabled={draftMutation.isPending}
            className={cn("flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors cursor-pointer",
              draftMutation.isPending ? "border-border text-muted-foreground cursor-not-allowed" : "border-foreground/20 text-foreground hover:bg-muted"
            )}
          >
            {draftMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {draftMutation.isPending ? "Generando..." : "Generar borrador"}
          </button>
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
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
          <button
            onClick={() => sendMutation.mutate({ id: signal.id, draft })}
            disabled={!draft || sendMutation.isPending}
            className={cn("flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
              draft && !sendMutation.isPending ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {sendMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer Convertir en Tarea ────────────────────────────────────────────────
function ConvertDrawer({ signal, onClose, onConverted }: {
  signal: { id: number; subject: string; fromName: string; snippet: string; fullBody?: string | null };
  onClose: () => void;
  onConverted: () => void;
}) {
  const [title, setTitle] = useState(signal.subject);
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");
  const [deadline, setDeadline] = useState("");
  const [createEvent, setCreateEvent] = useState(false);
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const hasDateTime = containsDateTime((signal.fullBody ?? signal.snippet).slice(0, 1000));

  const convertMutation = trpc.signals.convertToTask.useMutation();
  const calendarMutation = trpc.signals.createCalendarEvent.useMutation();
  const utils = trpc.useUtils();

  const handleSave = async () => {
    try {
      await convertMutation.mutateAsync({ id: signal.id, title: title.trim() || signal.subject, priority, deadline: deadline || undefined });
      if (createEvent && eventStart && eventEnd) {
        await calendarMutation.mutateAsync({ title: title.trim() || signal.subject, startDatetime: eventStart, endDatetime: eventEnd, signalId: signal.id });
      }
      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      await utils.actionPlan.list.invalidate();
      toast.success("Tarea creada");
      onConverted();
    } catch { toast.error("No se pudo crear la tarea"); }
  };

  const isPending = convertMutation.isPending || calendarMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Convertir en tarea</p>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
            <div className="flex gap-2">
              {(["alta", "media", "baja"] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={cn("text-sm px-3 py-1.5 rounded-full border transition-colors cursor-pointer capitalize",
                    priority === p ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >{p}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fecha límite (opcional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors" />
          </div>
          {hasDateTime && (
            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createEvent} onChange={(e) => setCreateEvent(e.target.checked)} className="rounded" />
                <span className="text-sm text-foreground">Crear también evento en Google Calendar</span>
              </label>
              {createEvent && (
                <div className="space-y-2 pl-5">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Inicio</label>
                    <input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors w-full" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fin</label>
                    <input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className="text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors w-full" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={isPending}
            className={cn("flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
              !isPending ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar tarea
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de correo ────────────────────────────────────────────────────────
function CorreoCard({ signal, onIgnored, onReplied, onConverted }: {
  signal: { id: number; subject: string; fromName: string; fromAddress: string; snippet: string; fullBody?: string | null; receivedAt?: Date | null; draftReply?: string | null; classifierUserFeedback?: "spot_on" | "not_important" | null };
  onIgnored: () => void; onReplied: () => void; onConverted: () => void;
}) {
  const [showReplyDrawer, setShowReplyDrawer] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);
  const utils = trpc.useUtils();

  const ignoreMutation = trpc.signals.ignore.useMutation({
    onSuccess: async () => { await utils.signals.list.invalidate(); await utils.signals.pendingCount.invalidate(); onIgnored(); },
    onError: () => toast.error("No se pudo ignorar"),
  });

  const feedbackMutation = trpc.signals.setClassifierFeedback.useMutation({
    onSuccess: async (_, vars) => {
      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      toast.success(
        vars.verdict === "spot_on"
          ? "Gracias. Tendré esto en cuenta al filtrar."
          : "Entendido: lo marcamos como poco importante y afinamos el filtro."
      );
    },
    onError: () => toast.error("No se pudo guardar tu opinión"),
  });

  return (
    <>
      <div className="border border-border rounded-xl p-4 space-y-3 bg-background hover:border-foreground/20 transition-colors">
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
          <span className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">{formatRelativeDate(signal.receivedAt)}</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{signal.snippet}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60 mt-2 pt-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Clasificación IA</span>
          <button
            type="button"
            title="Sí, esto sí era importante"
            disabled={!!signal.classifierUserFeedback || feedbackMutation.isPending}
            onClick={() => feedbackMutation.mutate({ id: signal.id, verdict: "spot_on" })}
            className={cn(
              "flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors cursor-pointer",
              signal.classifierUserFeedback === "spot_on"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
              (signal.classifierUserFeedback || feedbackMutation.isPending) && signal.classifierUserFeedback !== "spot_on" ? "opacity-40 cursor-not-allowed" : ""
            )}
          >
            <ThumbsUp className="h-3 w-3" /> Sí, importante
          </button>
          <button
            type="button"
            title="No era tan importante; quitar de la lista y enseñar al filtro"
            disabled={!!signal.classifierUserFeedback || feedbackMutation.isPending}
            onClick={() => feedbackMutation.mutate({ id: signal.id, verdict: "not_important" })}
            className={cn(
              "flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors cursor-pointer",
              signal.classifierUserFeedback === "not_important"
                ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
              (signal.classifierUserFeedback || feedbackMutation.isPending) && signal.classifierUserFeedback !== "not_important" ? "opacity-40 cursor-not-allowed" : ""
            )}
          >
            <ThumbsDown className="h-3 w-3" /> No era tan importante
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => setShowReplyDrawer(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
            <Send className="h-3 w-3" /> Responder
          </button>
          <button onClick={() => setShowConvertDrawer(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
            <Plus className="h-3 w-3" /> Tarea
          </button>
          <button onClick={() => ignoreMutation.mutate({ id: signal.id })} disabled={ignoreMutation.isPending} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-auto" title="Ignorar">
            <X className="h-3 w-3" /> Ignorar
          </button>
        </div>
      </div>
      {showReplyDrawer && (
        <ReplyDrawer signal={signal} onClose={() => setShowReplyDrawer(false)} onSent={async () => { setShowReplyDrawer(false); await utils.signals.list.invalidate(); await utils.signals.pendingCount.invalidate(); onReplied(); }} />
      )}
      {showConvertDrawer && (
        <ConvertDrawer signal={signal} onClose={() => setShowConvertDrawer(false)} onConverted={() => { setShowConvertDrawer(false); onConverted(); }} />
      )}
    </>
  );
}

// ─── Modal IMAP ───────────────────────────────────────────────────────────────
function ImapModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ connectedEmail: "", label: "", imapHost: "", imapPort: 993, imapUsername: "", imapPassword: "", smtpHost: "", smtpPort: 587, smtpSecure: false });
  const addMutation = trpc.signals.addImapAccount.useMutation({
    onSuccess: () => { toast.success("Cuenta añadida correctamente"); onAdded(); },
    onError: (e) => toast.error(e.message || "No se pudo añadir la cuenta"),
  });

  const f = (k: string, v: string | number | boolean) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Añadir cuenta IMAP/SMTP</p>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted cursor-pointer"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {[
            { key: "connectedEmail", label: "Dirección de email", placeholder: "tu@correo.com", type: "email" },
            { key: "label", label: "Etiqueta (opcional)", placeholder: "Trabajo, Personal…", type: "text" },
            { key: "imapHost", label: "Servidor IMAP", placeholder: "imap.tuproveedor.com", type: "text" },
            { key: "imapUsername", label: "Usuario IMAP", placeholder: "tu@correo.com", type: "text" },
            { key: "imapPassword", label: "Contraseña IMAP", placeholder: "••••••••", type: "password" },
            { key: "smtpHost", label: "Servidor SMTP", placeholder: "smtp.tuproveedor.com", type: "text" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={(e) => f(key, e.target.value)} placeholder={placeholder}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors" />
            </div>
          ))}
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Puerto IMAP</label>
              <input type="number" value={form.imapPort} onChange={(e) => f("imapPort", Number(e.target.value))} className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors" />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Puerto SMTP</label>
              <input type="number" value={form.smtpPort} onChange={(e) => f("smtpPort", Number(e.target.value))} className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.smtpSecure} onChange={(e) => f("smtpSecure", e.target.checked)} className="rounded" />
            <span className="text-sm text-foreground">Usar SSL en SMTP</span>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">Cancelar</button>
          <button
            onClick={() => addMutation.mutate(form)}
            disabled={addMutation.isPending}
            className={cn("flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
              !addMutation.isPending ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {addMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {addMutation.isPending ? "Verificando..." : "Añadir cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección de preferencias ──────────────────────────────────────────────────
function PreferenciasSection() {
  const [open, setOpen] = useState(false);
  const [localPrefs, setLocalPrefs] = useState("");
  const { data, isLoading } = trpc.signals.getEmailPrefs.useQuery();
  const setPrefs = trpc.signals.setEmailPrefs.useMutation({ onSuccess: () => toast.success("Preferencias guardadas") });

  // Sync server value into local state when loaded
  if (!isLoading && data?.prefs !== undefined && localPrefs === "" && data.prefs !== "") {
    setLocalPrefs(data.prefs);
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Preferencias de filtrado</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <p className="text-xs text-muted-foreground pt-3">
            Describe qué tipo de correos quieres ver y cuáles ignorar. La IA usará esto al filtrar tu bandeja. Además, cuando marques{" "}
            <strong className="text-foreground/90">Sí, importante</strong> o <strong className="text-foreground/90">No era tan importante</strong> en un correo, el sistema aprende de eso en las próximas sincronizaciones.
          </p>
          <textarea
            value={localPrefs}
            onChange={(e) => setLocalPrefs(e.target.value)}
            placeholder={'Ej: "Prioriza emails de clientes y proveedores. Ignora newsletters y notificaciones de redes sociales. Avísame siempre si hay facturas pendientes."'}
            rows={4}
            className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/40"
          />
          <div className="flex justify-end">
            <button
              onClick={() => setPrefs.mutate({ prefs: localPrefs })}
              disabled={setPrefs.isPending}
              className={cn("text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer",
                !setPrefs.isPending ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {setPrefs.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CorreosPage() {
  const utils = trpc.useUtils();
  const { data: accounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = trpc.signals.listAccounts.useQuery();
  const { data: signals, isLoading: signalsLoading } = trpc.signals.list.useQuery(
    { status: "pending" },
    { enabled: accounts.length > 0 }
  );
  const [showImapModal, setShowImapModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const syncMutation = trpc.signals.sync.useMutation({
    onSuccess: async (data) => {
      await utils.signals.list.invalidate();
      await utils.signals.pendingCount.invalidate();
      if (data.newSignals > 0) {
        toast.success(`${data.newSignals} correo${data.newSignals > 1 ? "s" : ""} nuevo${data.newSignals > 1 ? "s" : ""}`);
      } else {
        toast("Sin novedades en el correo");
      }
    },
    onError: () => toast.error("No se pudo sincronizar el correo"),
  });

  const removeMutation = trpc.signals.removeAccount.useMutation({
    onSuccess: () => { toast.success("Cuenta desconectada"); refetchAccounts(); utils.signals.pendingCount.invalidate(); },
    onError: () => toast.error("No se pudo desconectar la cuenta"),
  });

  const pendingSignals = signals ?? [];
  const hasAccounts = accounts.length > 0;

  const PROVIDER_LABELS: Record<string, string> = { google: "Gmail", microsoft: "Outlook", imap: "IMAP" };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Correos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Los que requieren tu atención</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAccounts && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className={cn("flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border transition-colors cursor-pointer",
                syncMutation.isPending ? "text-muted-foreground cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
              {syncMutation.isPending ? "Sincronizando..." : "Actualizar"}
            </button>
          )}
          {/* Menú añadir cuenta */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Añadir
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                  <a
                    href="/api/auth/google"
                    onClick={() => setShowAddMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Mail className="h-4 w-4 text-red-400" /> Gmail (Google)
                  </a>
                  <a
                    href="/api/auth/microsoft"
                    onClick={() => setShowAddMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Mail className="h-4 w-4 text-blue-400" /> Outlook (Microsoft)
                  </a>
                  <button
                    onClick={() => { setShowImapModal(true); setShowAddMenu(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer w-full text-left"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" /> Otro (IMAP/SMTP)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cuentas conectadas */}
      {!accountsLoading && accounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cuentas conectadas</p>
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between text-xs text-muted-foreground px-3 py-2 rounded-lg border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] uppercase font-medium bg-muted px-1.5 py-0.5 rounded text-foreground/60 flex-shrink-0">
                  {PROVIDER_LABELS[acc.provider] ?? acc.provider}
                </span>
                <span className="truncate">{acc.label ? `${acc.label} — ${acc.email}` : acc.email}</span>
              </div>
              <button
                onClick={() => { if (confirm("¿Desconectar esta cuenta?")) removeMutation.mutate({ id: acc.id }); }}
                className="flex-shrink-0 ml-2 p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                title="Desconectar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sin cuentas */}
      {!accountsLoading && !hasAccounts && (
        <div className="border border-border rounded-xl p-8 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Conecta tu correo</p>
            <p className="text-sm text-muted-foreground">Añade una o más cuentas y la app filtrará los emails que realmente importan.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <a href="/api/auth/google" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors">
              <Mail className="h-4 w-4" /> Conectar Gmail
            </a>
            <a href="/api/auth/microsoft" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
              <Mail className="h-4 w-4" /> Conectar Outlook
            </a>
            <button onClick={() => setShowImapModal(true)} className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
              <Mail className="h-4 w-4" /> Otro (IMAP)
            </button>
          </div>
        </div>
      )}

      {/* Preferencias de filtrado */}
      {hasAccounts && <PreferenciasSection />}

      {/* Lista de correos */}
      {hasAccounts && (
        <>
          {signalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-xl p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : pendingSignals.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Check className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Sin correos pendientes</p>
              <p className="text-xs text-muted-foreground/60">Pulsa "Actualizar" para revisar tu bandeja</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSignals.map((signal) => (
                <CorreoCard
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

      {showImapModal && <ImapModal onClose={() => setShowImapModal(false)} onAdded={() => { setShowImapModal(false); refetchAccounts(); }} />}
    </div>
  );
}
