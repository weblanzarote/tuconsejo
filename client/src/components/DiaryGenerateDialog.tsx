import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Loader2, MapPin, Sparkles, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DiaryLocationSuggestion {
  name: string;
  source: "manual" | "event";
  startIso?: string;
}

export interface DiaryLocationAnswer {
  name: string;
  notes?: string;
}

interface DiaryGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: DiaryLocationSuggestion[];
  isGenerating: boolean;
  onConfirm: (answers: DiaryLocationAnswer[]) => void;
}

interface RowState {
  name: string;
  source: "manual" | "event";
  startIso?: string;
  selected: boolean;
  notes: string;
}

function dedupeLocations(list: DiaryLocationSuggestion[]): DiaryLocationSuggestion[] {
  const seen = new Map<string, DiaryLocationSuggestion>();
  for (const loc of list) {
    const key = loc.name.trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, loc);
  }
  return Array.from(seen.values());
}

function formatTimeShort(iso?: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function DiaryGenerateDialog({
  open,
  onOpenChange,
  locations,
  isGenerating,
  onConfirm,
}: DiaryGenerateDialogProps) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [extraName, setExtraName] = useState("");

  useEffect(() => {
    if (!open) return;
    const unique = dedupeLocations(locations);
    setRows(
      unique.map((loc) => ({
        name: loc.name,
        source: loc.source,
        startIso: loc.startIso,
        selected: true,
        notes: "",
      }))
    );
    setExtraName("");
  }, [open, locations]);

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addExtra = () => {
    const trimmed = extraName.trim();
    if (!trimmed) return;
    setRows((prev) => [
      ...prev,
      { name: trimmed, source: "manual", selected: true, notes: "" },
    ]);
    setExtraName("");
  };

  const handleConfirm = () => {
    const answers: DiaryLocationAnswer[] = rows
      .filter((r) => r.selected && r.name.trim().length > 0)
      .map((r) => ({ name: r.name.trim(), notes: r.notes.trim() || undefined }));
    onConfirm(answers);
  };

  const handleSkip = () => {
    onConfirm([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isGenerating && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generar entrada con IA
          </DialogTitle>
          <DialogDescription>
            Antes de generar el borrador, repasa los lugares del día. Puedes añadir una nota corta sobre qué hiciste en
            cada sitio (opcional).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1 -mr-1">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No hay lugares detectados para hoy. Puedes añadir uno abajo o generar el borrador sin lugares.
            </p>
          )}
          {rows.map((row, idx) => (
            <div
              key={`${row.name}-${idx}`}
              className={cn(
                "rounded-lg border border-border/60 bg-background/40 p-3 space-y-2",
                !row.selected && "opacity-60"
              )}
            >
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                  className="h-3.5 w-3.5 cursor-pointer"
                  disabled={isGenerating}
                />
                <span className="flex-1 truncate">{row.name}</span>
                {row.source === "event" ? (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    {formatTimeShort(row.startIso) || "Calendario"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Manual
                  </span>
                )}
              </label>
              {row.selected && (
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateRow(idx, { notes: e.target.value })}
                  placeholder="¿Qué hiciste aquí? (opcional)"
                  maxLength={500}
                  disabled={isGenerating}
                  className="w-full text-sm bg-background/30 border border-border/60 focus:border-foreground/40 outline-none rounded-md px-2.5 py-1.5 placeholder:text-muted-foreground/60"
                />
              )}
            </div>
          ))}

          <div className="rounded-lg border border-dashed border-border/60 bg-background/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Añadir otro lugar</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExtra();
                  }
                }}
                placeholder="Nombre del lugar"
                disabled={isGenerating}
                className="flex-1 text-sm bg-background/30 border border-border/60 focus:border-foreground/40 outline-none rounded-md px-2.5 py-1.5"
              />
              <button
                type="button"
                onClick={addExtra}
                disabled={!extraName.trim() || isGenerating}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isGenerating}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 disabled:opacity-50"
          >
            Generar sin lugares
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-foreground/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/15 disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generar borrador
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
