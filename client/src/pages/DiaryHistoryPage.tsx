import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { formatYyyyMmDdInTimeZone, getDetectedTimeZone } from "@/lib/dateTz";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Search, MapPin, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOOD_COLORS: Record<string, string> = {
  bien: "#5C8A6D",
  regular: "#8A7A4A",
  mal: "#8A5C4A",
};

const MOOD_LABELS: Record<string, string> = {
  bien: "Bien",
  regular: "Regular",
  mal: "Mal",
};

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function getDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(yearMonth: string): number {
  // 0=Mon … 6=Sun (European week)
  const [year, month] = yearMonth.split("-").map(Number);
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function offsetMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DiaryHistoryPage() {
  const { user } = useLocalAuth();
  const tz = user?.timezone?.trim() || getDetectedTimeZone();
  const today = useMemo(() => formatYyyyMmDdInTimeZone(new Date(), tz), [tz]);
  const todayMonth = today.slice(0, 7);

  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: monthEntries = [] } = trpc.diary.listMonth.useQuery({ yearMonth: currentMonth });

  const { data: selectedEntry, isLoading: entryLoading } = trpc.diary.getEntry.useQuery(
    { date: selectedDate! },
    { enabled: !!selectedDate }
  );

  const { data: searchResults } = trpc.diary.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );

  const entryMap = useMemo(() => {
    const map = new Map<string, { mood?: string | null; hasContent: boolean }>();
    for (const e of monthEntries) {
      map.set(e.date, { mood: e.mood, hasContent: !!(e.content && e.content.trim()) });
    }
    return map;
  }, [monthEntries]);

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOffset = getFirstDayOfWeek(currentMonth);
  const [year, month] = currentMonth.split("-").map(Number);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearchQuery(q);
    if (q) setSelectedDate(null);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchInput("");
  };

  const selectSearchResult = (date: string) => {
    clearSearch();
    const resultMonth = date.slice(0, 7);
    setCurrentMonth(resultMonth);
    setSelectedDate(date);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hoy">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Volver a hoy"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="font-diary text-2xl text-foreground">Historial del diario</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Toca un día para leer esa entrada</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar en el diario…"
            className="w-full text-sm bg-muted/50 border border-border/60 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="submit"
          className="px-3 rounded-lg bg-foreground/10 border border-border hover:bg-foreground/15 transition-colors text-sm text-foreground"
        >
          Buscar
        </button>
      </form>

      {/* Search results */}
      {searchQuery && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              "{searchQuery}" — {searchResults?.length ?? "…"} resultado{searchResults?.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={clearSearch}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          </div>
          {searchResults === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin resultados para esa búsqueda.</p>
          ) : (
            <div className="space-y-1">
              {searchResults.map((e) => (
                <button
                  key={e.date}
                  type="button"
                  onClick={() => selectSearchResult(e.date)}
                  className="w-full text-left flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-14 flex-shrink-0 pt-0.5">
                    {formatDateShort(e.date)}
                  </span>
                  {e.mood && (
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: MOOD_COLORS[e.mood] ?? "transparent" }}
                    />
                  )}
                  <p className="text-sm text-foreground/80 line-clamp-2 flex-1">
                    {e.content?.slice(0, 120)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar — solo cuando no hay búsqueda activa */}
      {!searchQuery && (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentMonth(offsetMonth(currentMonth, -1))}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium capitalize text-foreground">
              {getMonthLabel(currentMonth)}
            </p>
            <button
              type="button"
              onClick={() => setCurrentMonth(offsetMonth(currentMonth, 1))}
              disabled={currentMonth >= todayMonth}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <p key={d} className="text-[11px] text-muted-foreground font-medium py-1">
                {d}
              </p>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const entry = entryMap.get(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > today;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => !isFuture && setSelectedDate(isSelected ? null : dateStr)}
                  disabled={isFuture}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors",
                    isFuture
                      ? "opacity-25 cursor-default"
                      : "cursor-pointer hover:bg-muted/40",
                    isSelected && "bg-foreground/10 hover:bg-foreground/15",
                    isToday && !isSelected && "ring-1 ring-inset ring-foreground/25"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs leading-none",
                      isToday ? "font-semibold text-foreground" : "text-foreground/70"
                    )}
                  >
                    {day}
                  </span>
                  {entry ? (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: entry.mood
                          ? MOOD_COLORS[entry.mood]
                          : "#666",
                      }}
                    />
                  ) : (
                    <div className="w-1.5 h-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-1">
            {Object.entries(MOOD_COLORS).map(([k, color]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-muted-foreground">{MOOD_LABELS[k]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#666]" />
              <span className="text-[11px] text-muted-foreground">Sin ánimo</span>
            </div>
          </div>
        </div>
      )}

      {/* Entry viewer */}
      {selectedDate && (
        <div className="space-y-4 border-t border-border pt-6 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-diary text-lg text-foreground capitalize leading-snug">
              {formatDateLong(selectedDate)}
            </h2>
            {selectedDate === today ? (
              <Link href="/hoy">
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer whitespace-nowrap">
                  Editar hoy →
                </span>
              </Link>
            ) : null}
          </div>

          {entryLoading ? (
            <div className="space-y-3 py-4">
              {[180, 140, 160].map((w, i) => (
                <div
                  key={i}
                  className="h-4 bg-muted/60 rounded animate-pulse"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
          ) : !selectedEntry || (!selectedEntry.content?.trim() && !selectedEntry.mood) ? (
            <p className="text-sm text-muted-foreground italic">Sin entrada para este día.</p>
          ) : (
            <div className="space-y-4">
              {/* Mood badge */}
              {selectedEntry.mood && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: MOOD_COLORS[selectedEntry.mood] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {MOOD_LABELS[selectedEntry.mood] ?? selectedEntry.mood}
                  </span>
                </div>
              )}

              {/* Content */}
              {selectedEntry.content?.trim() && (
                <div className="font-diary text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {selectedEntry.content}
                </div>
              )}

              {/* Locations */}
              {Array.isArray(selectedEntry.locationData) &&
                (selectedEntry.locationData as Array<{ name: string }>).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    {(selectedEntry.locationData as Array<{ name: string }>).map((loc, i) => (
                      <span
                        key={i}
                        className="text-xs bg-muted/60 px-2.5 py-0.5 rounded-full text-muted-foreground"
                      >
                        {loc.name}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
