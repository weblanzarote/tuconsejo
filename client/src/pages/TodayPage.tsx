import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import DiaryEntry from "@/components/DiaryEntry";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Save,
  Send,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { AGENT_NAMES, AGENT_EMOJIS, type AgentId } from "@/lib/agents";
import type { KeyboardEvent } from "react";

const DIARY_HINT_KEY = "tuconsejo.diary.saveHintDismissed.v1";

function getTodayLocal(): string {
  return new Date().toLocaleDateString("sv");
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

function persistFingerprint(
  text: string,
  mood: "bien" | "regular" | "mal" | null,
  locs: string[]
): string {
  return `${text}\0${mood ?? ""}\0${locs.join("\x1e")}`;
}

function SimpleMarkdown({ text }: { text: string }) {
  const cleaned = text.replace(/```json[\s\S]*?```/g, "").trim();
  const lines = cleaned.split("\n");
  return (
    <div className="chat-markdown text-sm text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# "))
          return (
            <p key={i} className="font-medium">
              {line.replace(/^#+\s/, "")}
            </p>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <li key={i} className="ml-4 list-disc">
              {line.slice(2)}
            </li>
          );
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function TodayPage() {
  const today = getTodayLocal();
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<"bien" | "regular" | "mal" | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasLoadedEntry, setHasLoadedEntry] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    try {
      setHintVisible(!localStorage.getItem(DIARY_HINT_KEY));
    } catch {
      setHintVisible(true);
    }
  }, []);

  const lastSavedFingerprint = useRef("");
  const diaryStateRef = useRef({ draft: "", mood: null as typeof mood, savedLocations: [] as string[] });
  diaryStateRef.current = { draft, mood, savedLocations };

  const [quickQuestion, setQuickQuestion] = useState("");
  const [quickResponse, setQuickResponse] = useState<Array<{ agentId: string; content: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);

  const utils = trpc.useUtils();
  const { data: entry, isLoading } = trpc.diary.getEntry.useQuery({ date: today });
  const { data: recentEntries } = trpc.diary.listRecent.useQuery({ limit: 8 });
  const upsert = trpc.diary.upsertEntry.useMutation({
    onSuccess: (saved) => {
      utils.diary.getEntry.setData({ date: today }, saved);
      void utils.diary.listRecent.invalidate();
      lastSavedFingerprint.current = persistFingerprint(
        saved.content ?? "",
        (saved.mood as "bien" | "regular" | "mal" | null) ?? null,
        locationsFromEntry(saved.locationData)
      );
    },
    onError: () => {
      toast.error("No se pudo guardar el diario. Comprueba la conexión e inténtalo de nuevo.");
    },
  });

  /** La mutación de tRPC puede cambiar de referencia cada render; no incluir `upsert` en deps de efectos */
  const upsertMutateRef = useRef(upsert.mutate);
  upsertMutateRef.current = upsert.mutate;

  const { data: pulseData, isLoading: pulseLoading } = trpc.signals.pulseOfDay.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const { data: allItems } = trpc.actionPlan.list.useQuery({ agentId: undefined });
  const updateStatus = trpc.actionPlan.updateStatus.useMutation();
  const predict = trpc.advisors.predict.useQuery({ content: quickQuestion }, { enabled: false });
  const ask = trpc.advisors.ask.useMutation();

  const focusTasks = (allItems ?? [])
    .filter((i) => i.status === "pendiente" || i.status === "en_progreso")
    .sort((a, b) => {
      const p = { alta: 0, media: 1, baja: 2 };
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
    })
    .slice(0, 3);

  useEffect(() => {
    setHasLoadedEntry(false);
  }, [today]);

  // Hidratación inicial: `hasLoadedEntry` evita que nuevas referencias de `entry` (tras setData) vuelvan a pisar el borrador
  useEffect(() => {
    if (isLoading) return;
    if (hasLoadedEntry) return;
    setDraft(entry?.content ?? "");
    setMood((entry?.mood as typeof mood) ?? null);
    setSavedLocations(locationsFromEntry(entry?.locationData));
    lastSavedFingerprint.current = persistFingerprint(
      entry?.content ?? "",
      (entry?.mood as typeof mood) ?? null,
      locationsFromEntry(entry?.locationData)
    );
    setHasLoadedEntry(true);
  }, [isLoading, hasLoadedEntry, entry]);

  const saveDiary = useCallback(async () => {
    const { draft: d, mood: m, savedLocations: locs } = diaryStateRef.current;
    const fp = persistFingerprint(d, m, locs);
    if (fp === lastSavedFingerprint.current) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      return;
    }
    setSaveStatus("saving");
    try {
      await upsert.mutateAsync({
        date: today,
        content: d,
        mood: m,
        locationData: locationsToPayload(locs),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }, [today, upsert]);

  const dismissHint = () => {
    try {
      localStorage.setItem(DIARY_HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    setHintVisible(false);
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
  };

  const handleDiaryKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void saveDiary();
    }
  };

  const handleToggleTask = async (id: number, status: string) => {
    const newStatus = status === "completada" ? "pendiente" : "completada";
    await updateStatus.mutateAsync({ itemId: id, status: newStatus as "pendiente" | "en_progreso" | "completada" });
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
        diaryContext: draft ? draft.slice(0, 400) : undefined,
      });
      setQuickResponse(result.responses.map((r: { agentId: string; content: string }) => ({ agentId: r.agentId, content: r.content })));
    } finally {
      setIsAsking(false);
    }
  };

  const handleMoodChange = (val: "bien" | "regular" | "mal") => {
    const newMood = mood === val ? null : val;
    setMood(newMood);
    void (async () => {
      setSaveStatus("saving");
      try {
        await upsert.mutateAsync({
          date: today,
          content: diaryStateRef.current.draft,
          mood: newMood,
          locationData: locationsToPayload(diaryStateRef.current.savedLocations),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    })();
  };

  const addLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    const newLocs = [...savedLocations, trimmed];
    setSavedLocations(newLocs);
    setLocationInput("");
    void (async () => {
      setSaveStatus("saving");
      try {
        await upsert.mutateAsync({
          date: today,
          content: draft,
          mood,
          locationData: locationsToPayload(newLocs),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    })();
  };

  const removeLocation = (idx: number) => {
    const newLocs = savedLocations.filter((_, i) => i !== idx);
    setSavedLocations(newLocs);
    void (async () => {
      setSaveStatus("saving");
      try {
        await upsert.mutateAsync({
          date: today,
          content: draft,
          mood,
          locationData: locationsToPayload(newLocs),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    })();
  };

  const appendPrompt = (prompt: string) => {
    const newContent = draft ? `${draft}\n\n${prompt}\n` : `${prompt}\n`;
    setDraft(newContent);
  };

  useEffect(() => {
    return () => {
      const { draft: d, mood: m, savedLocations: locs } = diaryStateRef.current;
      const fp = persistFingerprint(d, m, locs);
      if (fp === lastSavedFingerprint.current) return;
      void upsertMutateRef.current({
        date: today,
        content: d,
        mood: m,
        locationData: locationsToPayload(locs),
      });
    };
  }, [today]);

  const pastEntries = (recentEntries ?? []).filter((e) => e.date !== today);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* ── Cabecera: solo fecha + estado de guardado discreto ── */}
      <div className="space-y-1">
        <h1 className="font-diary text-3xl text-foreground capitalize">{formatDateLong(today)}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-[1.25rem]">
          {saveStatus === "saving" && <span>Guardando…</span>}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[#5C8A6D]">
              <Save className="h-3 w-3" /> Guardado
            </span>
          )}
        </div>
      </div>

      {/* ── Ayuda puntual (una vez) ── */}
      {hintVisible && (
        <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/40 backdrop-blur-sm px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
          <p className="flex-1">
            <span className="text-foreground/90">Consejo:</span> cuando termines un párrafo, usa{" "}
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>+
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Intro</kbd>{" "}
            (o{" "}
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">⌘</kbd>+
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Intro</kbd> en Mac) o el botón{" "}
            <strong className="text-foreground/80">Guardar</strong> debajo del texto. Así no guardamos mientras escribes.
          </p>
          <button
            type="button"
            onClick={dismissHint}
            className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Cerrar consejo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Pulso del día (skeleton solo mientras carga; si no hay resumen, no ocupa sitio) ── */}
      {pulseLoading && (
        <div className="h-20 rounded-xl border border-border/40 bg-muted/20 animate-pulse" aria-hidden />
      )}
      {!pulseLoading && pulseData?.summary && (
        <div className="border-l-2 border-foreground/20 pl-4 animate-fade-in">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Pulso del día</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{pulseData.summary}</p>
        </div>
      )}

      {/* ── Tu foco ── */}
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
                  type="button"
                  onClick={() => handleToggleTask(task.id, task.status)}
                  className="w-full flex items-center gap-3 text-left group"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <span
                    className={cn(
                      "text-sm flex-1 truncate",
                      done ? "line-through text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                  <span
                    className={cn(
                      "flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full",
                      task.priority === "alta"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : task.priority === "baja"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    {task.priority}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bloque diario: panel legible ── */}
      <section
        className={cn(
          "rounded-2xl border border-border/50 p-4 sm:p-5 space-y-4",
          "bg-background/65 dark:bg-background/45 backdrop-blur-md shadow-sm"
        )}
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tu diario</p>

        {!hasLoadedEntry ? (
          <div className="space-y-3 py-4">
            {[180, 140, 160].map((w, i) => (
              <div key={i} className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${w}px` }} />
            ))}
          </div>
        ) : (
          <>
            <DiaryEntry
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleDiaryKeyDown}
              placeholder="Escribe libremente sobre tu día. ¿Qué ha pasado? ¿Cómo te has sentido? No hay formato correcto..."
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground order-2 sm:order-1">
                <kbd className="rounded border border-border/60 px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>+
                <kbd className="rounded border border-border/60 px-1 py-0.5 font-mono text-[10px]">Intro</kbd> para guardar
              </p>
              <button
                type="button"
                onClick={() => void saveDiary()}
                disabled={saveStatus === "saving"}
                className="order-1 sm:order-2 inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-foreground/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/15 disabled:opacity-60"
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar entrada
              </button>
            </div>

            {/* Preguntas de apoyo */}
            <div className="border-t border-border/40 pt-3">
              <button
                type="button"
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
                      type="button"
                      onClick={() => appendPrompt(prompt)}
                      className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-1.5 px-3 rounded-md hover:bg-background/50 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ubicación y ánimo dentro del mismo panel */}
            <div className="border-t border-border/40 pt-4 space-y-4">
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
                        type="button"
                        onClick={() => removeLocation(i)}
                        className="text-xs bg-muted/80 text-muted-foreground px-2.5 py-1 rounded-full hover:bg-border transition-colors cursor-pointer"
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
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLocation();
                      }
                    }}
                    placeholder="Añadir lugar…"
                    className="flex-1 text-sm bg-background/30 border-b border-border/60 focus:border-foreground/40 outline-none py-1.5 placeholder:text-muted-foreground/50 transition-colors rounded-t px-1"
                  />
                  {locationInput.trim() && (
                    <button
                      type="button"
                      onClick={addLocation}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Añadir
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">¿Cómo ha ido el día?</p>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
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
            </div>
          </>
        )}
      </section>

      {/* ── Días anteriores ── */}
      {pastEntries.length > 0 && (
        <div className="border-t border-border pt-6 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Días anteriores</p>
          <div className="space-y-1">
            {pastEntries.slice(0, 7).map((e) => {
              const moodColor =
                e.mood === "bien"
                  ? "#5C8A6D"
                  : e.mood === "regular"
                    ? "#8A7A4A"
                    : e.mood === "mal"
                      ? "#8A5C4A"
                      : "transparent";
              return (
                <div key={e.date} className="flex items-start gap-3 py-2 group">
                  <div className="flex-shrink-0 w-14 text-right">
                    <span className="text-xs text-muted-foreground">{formatDateShort(e.date)}</span>
                  </div>
                  {e.mood && (
                    <div
                      className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                      style={{ backgroundColor: moodColor }}
                    />
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                    {e.content ? (
                      e.content.slice(0, 120)
                    ) : (
                      <span className="italic opacity-50">Sin texto</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Consulta rápida (al final; mismo peso visual que un extra) ── */}
      <div className="border-t border-border pt-8 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Consulta rápida a asesores</p>
        <p className="text-[11px] text-muted-foreground/90 -mt-1">
          Opcional: si quieres una segunda opinión breve, pregunta aquí. El chat completo sigue en Asesores.
        </p>
        <div className="flex gap-2 items-end">
          <textarea
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleQuickAsk();
              }
            }}
            placeholder="Pregunta algo a tus asesores…"
            disabled={isAsking}
            rows={2}
            className="flex-1 text-sm bg-muted/50 border border-border/60 rounded-lg px-3 py-2.5 resize-none min-h-[52px] max-h-[120px] focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleQuickAsk()}
            disabled={!quickQuestion.trim() || isAsking}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-lg transition-colors cursor-pointer self-end mb-0.5",
              quickQuestion.trim() && !isAsking
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label="Enviar pregunta"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {quickResponse.length > 0 && (
          <div className="space-y-2 animate-fade-in pt-1">
            {quickResponse.map((resp, i) => (
              <div key={i} className="border border-border/60 rounded-lg p-3.5 space-y-1.5 bg-background/30">
                <p className="text-xs font-medium text-muted-foreground">
                  {AGENT_EMOJIS[resp.agentId as AgentId] ?? "🔮"} {AGENT_NAMES[resp.agentId as AgentId] ?? resp.agentId}
                </p>
                <SimpleMarkdown text={resp.content} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
