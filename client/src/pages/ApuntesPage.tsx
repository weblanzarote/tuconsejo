import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import NoteCard, { type NoteTag } from "@/components/NoteCard";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  X,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  RefreshCw,
  ListPlus,
  Archive,
  ArchiveRestore,
  ExternalLink,
} from "lucide-react";
import { AGENT_NAMES, AGENT_EMOJIS, AGENT_COLORS, type AgentId } from "@/lib/agents";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Tab ──────────────────────────────────────────────────────────────────────
type Tab = "notas" | "tareas" | "habitos";

// ════════════════════════════════════════════════════════════════════════════
// NOTAS
// ════════════════════════════════════════════════════════════════════════════
type TagFilter = "todas" | NoteTag;

const TAG_OPTIONS: { value: TagFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "idea", label: "Ideas" },
  { value: "recordatorio", label: "Recordatorios" },
  { value: "compra", label: "Compras" },
  { value: "proyecto", label: "Proyectos" },
  { value: "otro", label: "Notas" },
];

interface EditingNote {
  id?: number;
  title: string;
  content: string;
  tag: NoteTag;
  isPinned: boolean;
  isArchived?: boolean;
}

function NotasTab() {
  const [noteScope, setNoteScope] = useState<"activas" | "archivadas">("activas");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>("todas");
  const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const { data: allNotes = [], refetch } = trpc.notes.list.useQuery();
  const { data: searchResults } = trpc.notes.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );
  const utils = trpc.useUtils();
  const createNote = trpc.notes.create.useMutation({ onSuccess: () => refetch() });
  const updateNote = trpc.notes.update.useMutation({ onSuccess: () => refetch() });
  const deleteNote = trpc.notes.delete.useMutation({ onSuccess: () => refetch() });
  const convertToTask = trpc.notes.convertToTask.useMutation({
    onSuccess: () => {
      utils.actionPlan.list.invalidate();
      refetch();
      toast.success("Idea convertida en tarea");
    },
    onError: () => toast.error("No se pudo convertir"),
  });

  const notes = searchQuery.length >= 2 ? (searchResults ?? []) : allNotes;
  const byScope = notes.filter((n) => (noteScope === "archivadas" ? n.isArchived : !n.isArchived));
  const filtered = tagFilter === "todas" ? byScope : byScope.filter((n) => n.tag === tagFilter);
  const pinned = filtered.filter((n) => n.isPinned);
  const unpinned = filtered.filter((n) => !n.isPinned);

  useEffect(() => {
    if (editingNote && editorRef.current) editorRef.current.focus();
  }, [editingNote?.id]);

  const openNew = () => {
    setEditingNote({ title: "", content: "", tag: "otro", isPinned: false, isArchived: false });
    setIsNewNote(true);
  };
  const openExisting = (note: typeof allNotes[0]) => {
    setEditingNote({
      id: note.id,
      title: note.title ?? "",
      content: note.content ?? "",
      tag: (note.tag ?? "otro") as NoteTag,
      isPinned: note.isPinned ?? false,
      isArchived: note.isArchived ?? false,
    });
    setIsNewNote(false);
  };
  const closeEditor = () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); setEditingNote(null); setIsNewNote(false); };

  const saveCurrentNote = async (note: EditingNote) => {
    if (note.id) {
      await updateNote.mutateAsync({ id: note.id, title: note.title, content: note.content, tag: note.tag, isPinned: note.isPinned });
    } else {
      const created = await createNote.mutateAsync({ title: note.title, content: note.content, tag: note.tag, isPinned: note.isPinned });
      setEditingNote((prev) => prev ? { ...prev, id: created?.id } : null);
      setIsNewNote(false);
    }
  };

  const handleFieldChange = (field: keyof EditingNote, value: string | boolean) => {
    if (!editingNote) return;
    const updated = { ...editingNote, [field]: value };
    setEditingNote(updated);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveCurrentNote(updated), 1000);
  };

  const handleDelete = async () => {
    if (!editingNote?.id) return;
    await deleteNote.mutateAsync({ id: editingNote.id });
    closeEditor();
  };

  const handleConvertToTask = async () => {
    if (!editingNote?.id) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    await saveCurrentNote(editingNote);
    await convertToTask.mutateAsync({ id: editingNote.id });
    closeEditor();
  };

  const handleTogglePin = async (id: number, current: boolean) => {
    await updateNote.mutateAsync({ id, isPinned: !current });
    refetch();
  };

  const handleToggleNoteArchive = async () => {
    if (!editingNote?.id) return;
    const next = !editingNote.isArchived;
    await updateNote.mutateAsync({ id: editingNote.id, isArchived: next });
    setEditingNote((prev) => (prev ? { ...prev, isArchived: next } : null));
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setNoteScope("activas")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              noteScope === "activas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Activas
          </button>
          <button
            type="button"
            onClick={() => setNoteScope("archivadas")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              noteScope === "archivadas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Archivadas
          </button>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm bg-foreground text-background px-3 py-1.5 rounded-md hover:bg-foreground/90 transition-colors cursor-pointer w-fit"
        >
          <Plus className="h-4 w-4" /> Nueva nota
        </button>
      </div>

      {editingNote && (
        <div className="border border-border rounded-lg bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={editingNote.tag} onChange={(e) => handleFieldChange("tag", e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-muted-foreground focus:outline-none focus:border-foreground/30 cursor-pointer">
              {TAG_OPTIONS.filter((t) => t.value !== "todas").map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
              {editingNote.id && (
                <button
                  type="button"
                  onClick={() => void handleToggleNoteArchive()}
                  disabled={updateNote.isPending}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer disabled:opacity-50"
                  title={editingNote.isArchived ? "Volver a notas activas (los asesores volverán a verla)" : "Archivar (deja de enviarse a los asesores)"}
                >
                  {editingNote.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  {editingNote.isArchived ? "Restaurar" : "Archivar"}
                </button>
              )}
              {editingNote.tag === "idea" && editingNote.id && (
                <button
                  onClick={handleConvertToTask}
                  disabled={convertToTask.isPending}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer disabled:opacity-50"
                  title="Convertir esta idea en una tarea"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Convertir en tarea
                </button>
              )}
              <button onClick={handleDelete} disabled={!editingNote.id} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-30" title="Eliminar nota">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={closeEditor} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <input type="text" value={editingNote.title} onChange={(e) => handleFieldChange("title", e.target.value)} placeholder="Título (opcional)"
            className="w-full text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50" />
          <textarea ref={editorRef} value={editingNote.content} onChange={(e) => handleFieldChange("content", e.target.value)} placeholder="Escribe aquí..."
            className="w-full text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none min-h-[120px]" rows={5} />
          <p className="text-xs text-muted-foreground/60">
            {updateNote.isPending || createNote.isPending ? "Guardando..." : isNewNote && !editingNote.id ? "Escribe para guardar automáticamente" : "Guardado"}
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar notas..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/30 transition-colors" />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TAG_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setTagFilter(opt.value)}
            className={cn("text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer",
              tagFilter === opt.value ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      {allNotes.length === 0 && !editingNote ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">Aún no tienes notas.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Crea una para guardar ideas, recordatorios o cualquier cosa.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {noteScope === "archivadas" ? "No hay notas archivadas." : "Sin resultados en activas."}
        </p>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Fijadas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {pinned.map((note) => (
                  <NoteCard key={note.id} id={note.id} title={note.title ?? ""} content={note.content ?? ""}
                    tag={(note.tag ?? "otro") as NoteTag} isPinned={note.isPinned ?? false} updatedAt={note.updatedAt}
                    onClick={() => openExisting(note)} onTogglePin={() => handleTogglePin(note.id, note.isPinned ?? false)} />
                ))}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div className="space-y-2">
              {pinned.length > 0 && <p className="text-xs text-muted-foreground uppercase tracking-wider">Resto</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {unpinned.map((note) => (
                  <NoteCard key={note.id} id={note.id} title={note.title ?? ""} content={note.content ?? ""}
                    tag={(note.tag ?? "otro") as NoteTag} isPinned={note.isPinned ?? false} updatedAt={note.updatedAt}
                    onClick={() => openExisting(note)} onTogglePin={() => handleTogglePin(note.id, note.isPinned ?? false)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CARD EXPANDIBLE — compartida por Tareas y Hábitos
// ════════════════════════════════════════════════════════════════════════════
const PRIORITY_COLORS: Record<string, string> = {
  alta: "#f43f5e",
  media: "#f59e0b",
  baja: "#10b981",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pendiente: Circle,
  en_progreso: Clock,
  completada: CheckCircle2,
  cancelada: Ban,
};

type PlanItem = {
  id: number;
  title: string;
  description?: string | null;
  category?: "trabajo" | "personal" | null;
  priority: string;
  status: string;
  agentId: string;
  deadline?: Date | null;
  metrica?: string | null;
  valorObjetivo?: string | null;
  tipo: string;
  isArchived?: boolean;
  sourceEmailSignalId?: number | null;
};

function PlanItemCard({
  item,
  onToggleStatus,
  onDelete,
  onChangeTipo,
  onSetArchived,
}: {
  item: PlanItem;
  onToggleStatus: (item: PlanItem) => void;
  onDelete: (id: number) => void;
  onChangeTipo: (id: number, tipo: "tarea" | "habito") => void;
  onSetArchived?: (id: number, archived: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const agentName = (AGENT_NAMES as Record<string, string>)[item.agentId] ?? item.agentId;
  const agentEmoji = (AGENT_EMOJIS as Record<string, string>)[item.agentId] ?? "🤖";
  const agentColor = (AGENT_COLORS as Record<string, string>)[item.agentId] ?? "#8b5cf6";
  const isCompleted = item.status === "completada";
  const isArchived = item.isArchived === true;
  const StatusIcon = STATUS_ICONS[item.status] ?? Circle;

  const { data: updates = [] } = trpc.actionPlan.listUpdates.useQuery(
    { itemId: item.id },
    { enabled: expanded && updatesOpen }
  );
  const addUpdate = trpc.actionPlan.addUpdate.useMutation({
    onSuccess: async () => {
      setNewUpdate("");
      await utils.actionPlan.listUpdates.invalidate({ itemId: item.id } as any);
      toast.success("Actualización añadida");
    },
    onError: () => toast.error("No se pudo añadir"),
  });
  const deleteUpdate = trpc.actionPlan.deleteUpdate.useMutation({
    onSuccess: async () => {
      await utils.actionPlan.listUpdates.invalidate({ itemId: item.id } as any);
    },
    onError: () => toast.error("No se pudo borrar"),
  });

  const { data: emailLink } = trpc.actionPlan.getSourceEmailLink.useQuery(
    { itemId: item.id },
    { enabled: expanded && !!item.sourceEmailSignalId }
  );

  const handleAddUpdate = async () => {
    const c = newUpdate.trim();
    if (!c) return;
    await addUpdate.mutateAsync({ itemId: item.id, content: c });
  };

  const handleChatClick = () => {
    const msg = `Tengo una duda sobre mi ${item.tipo === "habito" ? "hábito" : "tarea"}: "${item.title}". ${item.description ?? ""}`.trim();
    const target = item.agentId === "sala_juntas"
      ? `/boardroom?contexto=${encodeURIComponent(msg)}`
      : `/chat/${item.agentId}?contexto=${encodeURIComponent(msg)}`;
    navigate(target);
  };

  return (
    <div
      className={cn(
        "border border-border rounded-xl overflow-hidden bg-background transition-opacity",
        isCompleted && "opacity-55",
        isArchived && "border-dashed opacity-80"
      )}
    >
      {/* Cabecera siempre visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggleStatus(item)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Cambiar estado"
        >
          <StatusIcon className={cn("h-4 w-4", isCompleted && "text-green-500")} />
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className={cn("text-sm font-medium text-foreground truncate", isCompleted && "line-through text-muted-foreground")}>
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.category && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                {item.category === "trabajo" ? "Trabajo" : "Personal"}
              </span>
            )}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${PRIORITY_COLORS[item.priority] ?? "#8b5cf6"}20`, color: PRIORITY_COLORS[item.priority] ?? "#8b5cf6" }}>
              {item.priority === "alta" ? "Alta" : item.priority === "media" ? "Media" : "Baja"}
            </span>
            <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <span>{agentEmoji}</span> {agentName}
            </span>
            {item.deadline && (
              <span className="text-xs text-muted-foreground/60">
                {new Date(item.deadline).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}
          {item.metrica && (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground/60">Métrica:</span> {item.metrica}
              {item.valorObjetivo && <span className="text-foreground font-medium"> → {item.valorObjetivo}</span>}
            </p>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Botón consultar asesor */}
            <button
              onClick={handleChatClick}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ borderColor: `${agentColor}40`, color: agentColor, backgroundColor: `${agentColor}10` }}
            >
              <MessageCircle className="h-3 w-3" />
              Hablar con {agentName}
            </button>

            {/* Toggle tipo */}
            <button
              onClick={() => onChangeTipo(item.id, item.tipo === "habito" ? "tarea" : "habito")}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
              title={item.tipo === "habito" ? "Convertir en tarea" : "Convertir en hábito"}
            >
              <RefreshCw className="h-3 w-3" />
              {item.tipo === "habito" ? "Convertir en tarea" : "Convertir en hábito"}
            </button>

            {onSetArchived && (
              <button
                type="button"
                onClick={() => onSetArchived(item.id, !isArchived)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                title={
                  isArchived
                    ? "Desarchivar (vuelve al contexto de asesores si sigue en curso)"
                    : "Archivar (deja de enviarse a los asesores; no borra el ítem)"
                }
              >
                {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                {isArchived ? "Desarchivar" : "Archivar"}
              </button>
            )}

            {emailLink?.url && (
              <a
                href={emailLink.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                title="Abrir el email completo (si tu proveedor lo permite)"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir email
              </a>
            )}

            {/* Eliminar */}
            <button
              onClick={() => onDelete(item.id)}
              className="ml-auto flex items-center gap-1.5 text-xs px-2 py-1.5 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Actualizaciones */}
          <div className="border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setUpdatesOpen((v) => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {updatesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>Actualizaciones</span>
            </button>
            {updatesOpen && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2 items-start">
                  <textarea
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    rows={2}
                    placeholder="Añade un comentario de estado, lo que falta, próximos pasos…"
                    className="flex-1 text-sm bg-background/30 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddUpdate()}
                    disabled={!newUpdate.trim() || addUpdate.isPending}
                    className={cn(
                      "text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer",
                      newUpdate.trim() && !addUpdate.isPending
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Añadir
                  </button>
                </div>
                {updates.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">Aún no hay actualizaciones.</p>
                ) : (
                  <div className="space-y-2">
                    {updates.map((u: any) => (
                      <div key={u.id} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{u.content}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(u.createdAt).toLocaleString("es-ES")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteUpdate.mutate({ updateId: u.id })}
                          disabled={deleteUpdate.isPending}
                          className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer"
                          title="Borrar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAREAS
// ════════════════════════════════════════════════════════════════════════════
const STATUS_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completadas" },
] as const;

type StatusFilter = "todas" | "pendiente" | "en_progreso" | "completada";

function TareasTab() {
  const [planScope, setPlanScope] = useState<"activas" | "archivadas">("activas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [categoryFilter, setCategoryFilter] = useState<"todas" | "trabajo" | "personal">("todas");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "personal" as "trabajo" | "personal",
    priority: "media" as "alta" | "media" | "baja",
  });
  const utils = trpc.useUtils();

  const { data: allItems = [], isLoading } = trpc.actionPlan.list.useQuery({});
  const tareas = allItems.filter((i) => (i as any).tipo !== "habito");
  const tareasScoped = tareas.filter((i) => (planScope === "archivadas" ? (i as any).isArchived : !(i as any).isArchived));

  const updateStatus = trpc.actionPlan.updateStatus.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate(),
    onError: () => toast.error("No se pudo actualizar"),
  });
  const updateTipo = trpc.actionPlan.updateTipo.useMutation({
    onSuccess: () => {
      utils.actionPlan.list.invalidate();
      toast.success("Tipo actualizado");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });
  const deleteItem = trpc.actionPlan.delete.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate(),
    onError: () => toast.error("No se pudo eliminar"),
  });
  const setArchived = trpc.actionPlan.setArchived.useMutation({
    onSuccess: (_, v) => {
      utils.actionPlan.list.invalidate();
      toast.success(v.archived ? "Tarea archivada" : "Tarea restaurada");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const byStatus = statusFilter === "todas" ? tareasScoped : tareasScoped.filter((i) => i.status === statusFilter);
  const filtered =
    categoryFilter === "todas" ? byStatus : byStatus.filter((i) => (i as any).category === categoryFilter);

  const nextStatus = (current: string) =>
    current === "pendiente" ? "en_progreso" : current === "en_progreso" ? "completada" : "pendiente";

  const createManual = trpc.actionPlan.add.useMutation({
    onSuccess: async () => {
      await utils.actionPlan.list.invalidate();
      toast.success("Tarea creada");
      setShowNewTask(false);
      setNewTask({ title: "", description: "", category: "personal", priority: "media" });
    },
    onError: () => toast.error("No se pudo crear"),
  });

  const saveManualTask = async () => {
    const title = newTask.title.trim();
    if (!title) return;
    await createManual.mutateAsync({
      agentId: "guardian",
      title,
      description: newTask.description.trim() || undefined,
      category: newTask.category,
      priority: newTask.priority,
      tipo: "tarea",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setPlanScope("activas")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                planScope === "activas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Activas
            </button>
            <button
              type="button"
              onClick={() => setPlanScope("archivadas")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                planScope === "archivadas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Archivadas
            </button>
          </div>

          <div className="flex rounded-lg border border-border p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setCategoryFilter("todas")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                categoryFilter === "todas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("trabajo")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                categoryFilter === "trabajo" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Trabajo
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("personal")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                categoryFilter === "personal" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Personal
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-1.5 text-sm bg-foreground text-background px-3 py-1.5 rounded-md hover:bg-foreground/90 transition-colors cursor-pointer w-fit"
        >
          <Plus className="h-4 w-4" /> Nueva tarea
        </button>
      </div>

      {showNewTask && (
        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Nueva tarea</p>
            <button
              type="button"
              onClick={() => setShowNewTask(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
            placeholder="Título de la tarea"
            className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-foreground/30 transition-colors"
          />
          <textarea
            value={newTask.description}
            onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Descripción (opcional)"
            className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/50"
          />
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={newTask.category}
              onChange={(e) => setNewTask((p) => ({ ...p, category: e.target.value as any }))}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-muted-foreground focus:outline-none focus:border-foreground/30 cursor-pointer"
            >
              <option value="trabajo">Trabajo</option>
              <option value="personal">Personal</option>
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as any }))}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-muted-foreground focus:outline-none focus:border-foreground/30 cursor-pointer"
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <button
              type="button"
              onClick={() => void saveManualTask()}
              disabled={!newTask.title.trim() || createManual.isPending}
              className={cn(
                "ml-auto text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer",
                newTask.title.trim() && !createManual.isPending
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {createManual.isPending ? "Guardando..." : "Crear"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer",
              statusFilter === opt.value
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse h-16 bg-muted/20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {planScope === "archivadas"
              ? "No hay tareas archivadas."
              : statusFilter === "todas"
                ? "Sin tareas todavía."
                : "Sin tareas en este estado."}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Las tareas se crean desde las conversaciones con los asesores. Archivar no las borra: solo las quita del
            contexto automático de la IA.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <PlanItemCard
              key={item.id}
              item={{ ...item, tipo: (item as any).tipo ?? "tarea" } as PlanItem}
              onToggleStatus={(i) => updateStatus.mutate({ itemId: i.id, status: nextStatus(i.status) as any })}
              onDelete={(id) => deleteItem.mutate({ itemId: id })}
              onChangeTipo={(id, tipo) => updateTipo.mutate({ itemId: id, tipo })}
              onSetArchived={(id, archived) => setArchived.mutate({ itemId: id, archived })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HÁBITOS
// ════════════════════════════════════════════════════════════════════════════
function HabitosTab() {
  const [planScope, setPlanScope] = useState<"activas" | "archivadas">("activas");
  const utils = trpc.useUtils();

  const { data: allItems = [], isLoading } = trpc.actionPlan.list.useQuery({});
  const habitosAll = allItems.filter((i) => (i as any).tipo === "habito");
  const habitos = habitosAll.filter((i) => (planScope === "archivadas" ? (i as any).isArchived : !(i as any).isArchived));

  const updateStatus = trpc.actionPlan.updateStatus.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate(),
    onError: () => toast.error("No se pudo actualizar"),
  });
  const updateTipo = trpc.actionPlan.updateTipo.useMutation({
    onSuccess: () => {
      utils.actionPlan.list.invalidate();
      toast.success("Tipo actualizado");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });
  const deleteItem = trpc.actionPlan.delete.useMutation({
    onSuccess: () => utils.actionPlan.list.invalidate(),
    onError: () => toast.error("No se pudo eliminar"),
  });
  const setArchived = trpc.actionPlan.setArchived.useMutation({
    onSuccess: (_, v) => {
      utils.actionPlan.list.invalidate();
      toast.success(v.archived ? "Hábito archivado" : "Hábito restaurado");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const nextStatus = (current: string) =>
    current === "pendiente" ? "en_progreso" : current === "en_progreso" ? "completada" : "pendiente";

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg border border-border p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setPlanScope("activas")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
            planScope === "activas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Activas
        </button>
        <button
          type="button"
          onClick={() => setPlanScope("archivadas")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer",
            planScope === "archivadas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Archivadas
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Prácticas y rutinas recomendadas por tus asesores. Los que están en curso se envían como contexto a la IA hasta
        que los completes o archivés.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse h-16 bg-muted/20" />
          ))}
        </div>
      ) : habitos.length === 0 ? (
        <div className="py-12 text-center">
          <RefreshCw className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {planScope === "archivadas" ? "No hay hábitos archivados." : "Sin hábitos todavía."}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Los asesores los generarán automáticamente. También puedes convertir una tarea en hábito desde la pestaña
            Tareas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {habitos.map((item) => (
            <PlanItemCard
              key={item.id}
              item={{ ...item, tipo: "habito" } as PlanItem}
              onToggleStatus={(i) => updateStatus.mutate({ itemId: i.id, status: nextStatus(i.status) as any })}
              onDelete={(id) => deleteItem.mutate({ itemId: id })}
              onChangeTipo={(id, tipo) => updateTipo.mutate({ itemId: id, tipo })}
              onSetArchived={(id, archived) => setArchived.mutate({ itemId: id, archived })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function ApuntesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notas");
  const { data: allNotes = [] } = trpc.notes.list.useQuery();
  const { data: allItems = [] } = trpc.actionPlan.list.useQuery({});

  const tareas = allItems.filter((i) => (i as any).tipo !== "habito");
  const habitos = allItems.filter((i) => (i as any).tipo === "habito");
  const activeNotesCount = allNotes.filter((n) => !n.isArchived).length;
  const pendingTareas = tareas.filter(
    (t) => !(t as { isArchived?: boolean }).isArchived && (t.status === "pendiente" || t.status === "en_progreso")
  ).length;
  const activeHabitos = habitos.filter((h) => !(h as { isArchived?: boolean }).isArchived).length;

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "notas", label: "Notas", badge: activeNotesCount > 0 ? activeNotesCount : undefined },
    { key: "tareas", label: "Tareas", badge: pendingTareas > 0 ? pendingTareas : undefined },
    { key: "habitos", label: "Hábitos", badge: activeHabitos > 0 ? activeHabitos : undefined },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Apuntes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Notas, tareas y hábitos en un mismo lugar</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px flex items-center gap-2",
              activeTab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {badge !== undefined && (
              <span className={cn(
                "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium inline-flex items-center justify-center",
                activeTab === key ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "notas" && <NotasTab />}
      {activeTab === "tareas" && <TareasTab />}
      {activeTab === "habitos" && <HabitosTab />}
    </div>
  );
}
