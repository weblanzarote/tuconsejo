import { cn } from "@/lib/utils";
import { Pin, PinOff } from "lucide-react";

export type NoteTag = "idea" | "recordatorio" | "compra" | "proyecto" | "otro";

const TAG_COLORS: Record<NoteTag, string> = {
  idea: "#5B8E7D",
  recordatorio: "#8E7D5B",
  compra: "#5B6B8E",
  proyecto: "#7D5B8E",
  otro: "#7A7870",
};

const TAG_LABELS: Record<NoteTag, string> = {
  idea: "Idea",
  recordatorio: "Recordatorio",
  compra: "Compra",
  proyecto: "Proyecto",
  otro: "Nota",
};

function formatRelativeDate(ts: number | Date | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

interface NoteCardProps {
  id: number;
  title: string;
  content: string;
  tag: NoteTag;
  isPinned: boolean;
  updatedAt: number | Date | null;
  onClick: () => void;
  onTogglePin: () => void;
}

export default function NoteCard({
  title,
  content,
  tag,
  isPinned,
  updatedAt,
  onClick,
  onTogglePin,
}: NoteCardProps) {
  const color = TAG_COLORS[tag];
  const preview = content.replace(/\n/g, " ").slice(0, 160);

  return (
    <div
      className="group relative border border-border rounded-lg p-4 cursor-pointer hover:border-foreground/20 transition-colors bg-card"
      onClick={onClick}
    >
      {/* Tag dot */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-medium" style={{ color }}>{TAG_LABELS[tag]}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{formatRelativeDate(updatedAt)}</span>
          <button
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded cursor-pointer",
              "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={isPinned ? "Desfijar" : "Fijar"}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {title && (
        <p className="text-sm font-medium text-foreground mb-1 truncate">{title}</p>
      )}
      {preview && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{preview}</p>
      )}
      {!title && !content && (
        <p className="text-sm text-muted-foreground/50 italic">Nota vacía</p>
      )}
    </div>
  );
}
