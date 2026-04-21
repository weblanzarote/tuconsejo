import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import DiaryEntry from "@/components/DiaryEntry";
import { ChevronDown, ChevronUp, Loader2, MapPin, Save, Send, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  MAIN_AGENTS,
  AGENT_NAMES,
  AGENT_EMOJIS,
  type AgentId,
} from "@/lib/agents";

// Obtiene la fecha local en formato YYYY-MM-DD
function getTodayLocal(): string {
  return new Date().toLocaleDateString("sv"); // sv locale → YYYY-MM-DD en hora local
}

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const GUIDED_PROMPTS = [
  "¿Qué fue lo mejor del día?",
  "¿Algo que quieras recordar?",
  "¿Qué mejorarías si pudieras repetirlo?",
  "¿Una persona a la que agradecer hoy?",
];

const MOOD_OPTIONS = [
  { value: "bien", label: "Bien", color: "#5C8A6D" },
  { value: "regular", label: "Regular", color: "#8A7A4A" },
  { value: "mal", label: "Mal", color: "#8A5C4A" },
] as const;

const DIARY_DEBOUNCE_MS = 800;

/** El API (Zod) espera { name }[]; la UI trabaja con string[] */
function locationsToPayload(locs: string[]): { name: string }[] | undefined {
  if (locs.length === 0) return undefined;
  return locs.map((name) => ({ name }));
}

function locationsFromEntry(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item && typeof (item as { name: unknown }).name === "string") {
        return (item as { name: string }).name;
      }
      return "";
    })
    .filter(Boolean);
}

// ─── Markdown simple (reutilizado de AsesoresPage) ────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const cleaned = text.replace(/```json[\s\S]*?```/g, "").trim();
  const lines = cleaned.split("\n");
  return (
    <div className="chat-markdown text-sm text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# "))
          return <p key={i} className="font-medium">{line.replace(/^#+\s/, "")}</p>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function TodayPage() {
  const today = getTodayLocal();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<"bien" | "regular" | "mal" | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diaryStateRef = useRef({ content: "", mood: null as typeof mood, savedLocations: [] as string[] });
  diaryStateRef.current = { content, mood, savedLocations };

  const utils = trpc.useUtils();

  // Consulta rápida
  const [quickQuestion, setQuickQuestion] = useState("");
  const [quickResponse, setQuickResponse] = useState<Array<{ agentId: string; content: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);

  const { data: entry, isLoading } = trpc.diary.getEntry.useQuery({ date: today });
  const { data: recentEntries } = trpc.diary.listRecent.useQuery({ limit: 8 });
  const upsert = trpc.diary.upsertEntry.useMutation({
    onSuccess: async () => {
      await utils.diary.getEntry.invalidate({ date: today });
      await utils.diary.listRecent.invalidate();
    },
    onError: () => {
      toast.error("No se pudo guardar el diario. Comprueba la conexión e inténtalo de nuevo.");
    },
  });

  // Señales y tareas para el dashboard
  const { data: pulseData } = trpc.signals.pulseOfDay.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const { data: allItems } = trpc.actionPlan.list.useQuery({ agentId: undefined });
  const updateStatus = trpc.actionPlan.updateStatus.useMutation();
  const predict = trpc.advisors.predict.useQuery({ content: quickQuestion }, { enabled: false });
  const ask = trpc.advisors.ask.useMutation();

  // Máximo 3 tareas activas (foco)
  const focusTasks = (allItems ?? [])
    .filter((i) => i.status === "pendiente" || i.status === "en_progreso")
    .sort((a, b) => {
      const p = { alta: 0, media: 1, baja: 2 };
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
    })
    .slice(0, 3);

  const handleToggleTask = async (id: number, status: string) => {
    const newStatus = status === "completada" ? "pendiente" : "completada";
    await updateStatus.mutateAsync({ itemId: id, status: newStatus as any });
  };

  const handleQuickAsk = async () => {
    const q = quickQuestion.trim();
    if (!q || isAsking) return;
    setIsAsking(true);
    try {
      const predicted = await predict.refetch();
      const agentIds = (predicted.data?.suggestedAgentIds ?? ["guardian"]).slice(0, 2) as AgentId[];
      const validAgents = agentIds.filter((id): id is Exclude<AgentId, "sala_juntas" | "encuestador"> =>
        ["economia", "carrera", "salud", "relaciones", "familia", "guardian"].includes(id)
      );
      const result = await ask.mutateAsync({
        content: q,
        agentIds: validAgents.length > 0 ? validAgents : ["guardian"],
        diaryContext: content ? content.slice(0, 400) : undefined,
      });
      setQuickResponse(
        result.responses.map((r: any) => ({ agentId: r.agentId, content: r.content }))
      );
    } finally {
      setIsAsking(false);
    }
  };

  // Cargar entrada existente
  useEffect(() => {
    if (entry) {
      setContent(entry.content ?? "");
      setMood(entry.mood ?? null);
      setSavedLocations(locationsFromEntry(entry.locationData));
    }
  }, [entry]);

  const save = useCallback(
    async (newContent: string, newMood: typeof mood, locs?: string[]) => {
      const locList = locs ?? diaryStateRef.current.savedLocations;
      setSaveStatus("saving");
      try {
        await upsert.mutateAsync({
          date: today,
          content: newContent,
          mood: newMood,
          locationData: locationsToPayload(locList),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [today, upsert]
  );

  /** Guarda ya mismo (sin esperar al debounce): al salir del campo, botón, o al desmontar la vista */
  const flushPendingSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const { content: c, mood: m, savedLocations: locs } = diaryStateRef.current;
    await save(c, m, locs);
  }, [save]);

  // Si había un guardado pendiente (usuario escribió y salió antes del debounce), persistir al desmontar
  useEffect(() => {
    return () => {
      if (!debounceRef.current) return;
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      const { content: c, mood: m, savedLocations: locs } = diaryStateRef.current;
      void upsert.mutate({
        date: today,
        content: c,
        mood: m,
        locationData: locationsToPayload(locs),
      });
    };
  }, [today, upsert]);

  // Auto-save con debounce (al disparar, lee el texto actual del ref por si seguiste escribiendo)
  const handleContentChange = (val: string) => {
    setContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("idle");
    debounceRef.current = setTimeout(() => {
      const { content: c, mood: m } = diaryStateRef.current;
      void save(c, m);
    }, DIARY_DEBOUNCE_MS);
  };

  const handleMoodChange = (val: "bien" | "regular" | "mal") => {
    const newMood = mood === val ? null : val;
    setMood(newMood);
    save(content, newMood);
  };

  const addLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    const newLocs = [...savedLocations, trimmed];
    setSavedLocations(newLocs);
    setLocationInput("");
    save(content, mood, newLocs);
  };

  const removeLocation = (idx: number) => {
    const newLocs = savedLocations.filter((_, i) => i !== idx);
    setSavedLocations(newLocs);
    save(content, mood, newLocs);
  };

  const appendPrompt = (prompt: string) => {
    const newContent = content
      ? `${content}\n\n${prompt}\n`
      : `${prompt}\n`;
    setContent(newContent);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { content: c, mood: m } = diaryStateRef.current;
      void save(c, m);
    }, DIARY_DEBOUNCE_MS);
  };

  const pastEntries = (recentEntries ?? []).filter((e) => e.date !== today);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* ── Cabecera ── */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-diary text-3xl text-foreground capitalize">
            {formatDateLong(today)}
          </h1>
          <button
            type="button"
            onClick={() => void flushPendingSave()}
            disabled={saveStatus === "saving"}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar ahora
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
          El texto se guarda solo unos segundos después de dejar de escribir. Si cambias de página antes, pulsa «Guardar ahora» o sal del cuadro de texto (toca fuera) para no perder nada.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveStatus === "saving" && <span>Guardando...</span>}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[#5C8A6D]">
              <Save className="h-3 w-3" /> Guardado
            </span>
          )}
        </div>
      </div>

      {/* ── Pulso del día ── */}
      {pulseData?.summary && (
        <div className="border-l-2 border-foreground/20 pl-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Pulso del día</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{pulseData.summary}</p>
        </div>
      )}

      {/* ── Tu foco (máx. 3 tareas) ── */}
      {focusTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Tu foco</p>
            <Link href="/dashboard">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2">
                Ver todo →
              </span>
            </Link>
          </div>
          <div className="space-y-2">
            {focusTasks.map((task) => {
              const done = task.status === "completada";
              return (
                <button
                  key={task.id}
                  onClick={() => handleToggleTask(task.id, task.status)}
                  className="w-full flex items-center gap-3 text-left group"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <span className={cn(
                    "text-sm flex-1 truncate",
                    done ? "line-through text-muted-foreground" : "text-foreground"
                  )}>
                    {task.title}
                  </span>
                  <span className={cn(
                    "flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full",
                    task.priority === "alta"
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : task.priority === "baja"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                  )}>
                    {task.priority}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Consulta rápida ── */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Consulta rápida</p>
        <div className="flex gap-2 items-end">
          <textarea
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickAsk(); }
            }}
            placeholder="Pregunta algo a tus asesores..."
            disabled={isAsking}
            rows={1}
            className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none min-h-[44px] max-h-[120px] focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50 disabled:opacity-60"
          />
          <button
            onClick={handleQuickAsk}
            disabled={!quickQuestion.trim() || isAsking}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-lg transition-colors cursor-pointer",
              quickQuestion.trim() && !isAsking
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {quickResponse.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            {quickResponse.map((resp, i) => (
              <div key={i} className="border border-border rounded-lg p-3.5 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {AGENT_EMOJIS[resp.agentId as AgentId] ?? "🔮"} {AGENT_NAMES[resp.agentId as AgentId] ?? resp.agentId}
                </p>
                <SimpleMarkdown text={resp.content} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ubicaciones ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>¿Dónde estuviste hoy?</span>
        </div>
        {savedLocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedLocations.map((loc, i) => (
              <button
                key={i}
                onClick={() => removeLocation(i)}
                className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full hover:bg-border transition-colors cursor-pointer"
                title="Clic para eliminar"
              >
                {loc} ×
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addLocation(); }
            }}
            placeholder="Añadir lugar..."
            className="flex-1 text-sm bg-transparent border-b border-border focus:border-foreground outline-none py-1 placeholder:text-muted-foreground/50 transition-colors"
          />
          {locationInput.trim() && (
            <button
              onClick={addLocation}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Añadir
            </button>
          )}
        </div>
      </div>

      {/* ── Estado de ánimo ── */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">¿Cómo ha ido el día?</p>
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleMoodChange(opt.value)}
              className={cn(
                "text-sm px-4 py-1.5 rounded-full border transition-all cursor-pointer",
                mood === opt.value
                  ? "border-current font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              )}
              style={mood === opt.value ? { color: opt.color, borderColor: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Separador ── */}
      <div className="border-t border-border" />

      {/* ── Entrada de diario ── */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          {[180, 140, 160].map((w, i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${w}px` }} />
          ))}
        </div>
      ) : (
        <DiaryEntry
          value={content}
          onChange={handleContentChange}
          onBlur={() => void flushPendingSave()}
          placeholder="Escribe libremente sobre tu día. ¿Qué ha pasado? ¿Cómo te has sentido? No hay formato correcto..."
        />
      )}

      {/* ── Prompts guiados ── */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setPromptsOpen(!promptsOpen)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full text-left"
        >
          {promptsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>Preguntas de apoyo</span>
        </button>
        {promptsOpen && (
          <div className="mt-3 space-y-1.5 animate-fade-in">
            {GUIDED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => appendPrompt(prompt)}
                className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-1.5 px-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Entradas anteriores ── */}
      {pastEntries.length > 0 && (
        <div className="border-t border-border pt-6 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Días anteriores</p>
          <div className="space-y-1">
            {pastEntries.slice(0, 7).map((e) => {
              const moodColor =
                e.mood === "bien" ? "#5C8A6D" : e.mood === "regular" ? "#8A7A4A" : e.mood === "mal" ? "#8A5C4A" : "transparent";
              return (
                <div key={e.date} className="flex items-start gap-3 py-2 group">
                  <div className="flex-shrink-0 w-14 text-right">
                    <span className="text-xs text-muted-foreground">{formatDateShort(e.date)}</span>
                  </div>
                  {e.mood && (
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: moodColor }} />
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                    {e.content ? e.content.slice(0, 120) : <span className="italic opacity-50">Sin texto</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
