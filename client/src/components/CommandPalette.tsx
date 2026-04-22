import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  FileText,
  Mail,
  MessageSquare,
  CheckSquare,
  BookOpen,
  Search,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type Item = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  href: string;
  category: string;
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = trpc.search.all.useQuery(
    { query: debounced },
    { enabled: debounced.length >= 2, staleTime: 30_000 }
  );

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const out: Item[] = [];
    for (const n of data.notes) {
      out.push({
        key: `note-${n.id}`,
        icon: FileText,
        label: n.title || n.snippet || "Nota sin título",
        sub: n.tag,
        href: `/apuntes?note=${n.id}`,
        category: "Apuntes",
      });
    }
    for (const t of data.tasks) {
      out.push({
        key: `task-${t.id}`,
        icon: CheckSquare,
        label: t.title,
        sub: `${t.agentId} · ${t.status}`,
        href: `/dashboard?task=${t.id}`,
        category: "Tareas",
      });
    }
    for (const s of data.signals) {
      out.push({
        key: `signal-${s.id}`,
        icon: Mail,
        label: s.subject || "(sin asunto)",
        sub: s.fromName,
        href: `/correos`,
        category: "Correos",
      });
    }
    for (const c of data.conversations) {
      out.push({
        key: `conv-${c.id}`,
        icon: MessageSquare,
        label: c.title,
        sub: c.agentId,
        href: `/chat/${c.agentId}`,
        category: "Conversaciones",
      });
    }
    for (const d of data.diary) {
      out.push({
        key: `diary-${d.id}`,
        icon: BookOpen,
        label: d.date,
        sub: d.snippet,
        href: `/diario?date=${d.date}`,
        category: "Diario",
      });
    }
    return out;
  }, [data]);

  useEffect(() => {
    if (cursor >= items.length) setCursor(0);
  }, [items, cursor]);

  const go = (item: Item) => {
    setOpen(false);
    navigate(item.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, Math.max(0, items.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && items[cursor]) {
                e.preventDefault();
                go(items[cursor]);
              }
            }}
            placeholder="Buscar en apuntes, tareas, correos, conversaciones, diario…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {isFetching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {debounced.length < 2 && (
            <p className="text-xs text-muted-foreground px-4 py-6 text-center">
              Escribe al menos 2 letras para buscar.
            </p>
          )}
          {debounced.length >= 2 && !isFetching && items.length === 0 && (
            <p className="text-xs text-muted-foreground px-4 py-6 text-center">
              Sin resultados.
            </p>
          )}
          {items.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === cursor;
            return (
              <button
                key={item.key}
                onMouseEnter={() => setCursor(idx)}
                onClick={() => go(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                  active ? "bg-muted/60" : "hover:bg-muted/40"
                )}
              >
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{item.label}</p>
                  {item.sub && (
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-shrink-0">
                  {item.category}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          <span>↑↓ navegar · ↵ abrir</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
