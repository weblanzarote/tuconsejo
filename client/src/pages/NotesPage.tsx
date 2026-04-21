import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import NoteCard, { type NoteTag } from "@/components/NoteCard";
import { cn } from "@/lib/utils";
import { Plus, Search, X, Trash2 } from "lucide-react";

type TagFilter = "todas" | NoteTag;

const TAG_OPTIONS: { value: TagFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "idea", label: "Ideas" },
  { value: "recordatorio", label: "Recordatorios" },
  { value: "compra", label: "Compras" },
  { value: "proyecto", label: "Proyectos" },
  { value: "otro", label: "Notas" },
];

const TAG_COLORS: Record<NoteTag, string> = {
  idea: "#5B8E7D",
  recordatorio: "#8E7D5B",
  compra: "#5B6B8E",
  proyecto: "#7D5B8E",
  otro: "#7A7870",
};

interface EditingNote {
  id?: number;
  title: string;
  content: string;
  tag: NoteTag;
  isPinned: boolean;
}

export default function NotesPage() {
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
  const createNote = trpc.notes.create.useMutation({ onSuccess: () => refetch() });
  const updateNote = trpc.notes.update.useMutation({ onSuccess: () => refetch() });
  const deleteNote = trpc.notes.delete.useMutation({ onSuccess: () => refetch() });

  const notes = searchQuery.length >= 2 ? (searchResults ?? []) : allNotes;
  const filtered = tagFilter === "todas"
    ? notes
    : notes.filter((n) => n.tag === tagFilter);
  const pinned = filtered.filter((n) => n.isPinned);
  const unpinned = filtered.filter((n) => !n.isPinned);

  useEffect(() => {
    if (editingNote && editorRef.current) {
      editorRef.current.focus();
    }
  }, [editingNote?.id]);

  const openNew = () => {
    setEditingNote({ title: "", content: "", tag: "otro", isPinned: false });
    setIsNewNote(true);
  };

  const openExisting = (note: typeof allNotes[0]) => {
    setEditingNote({
      id: note.id,
      title: note.title ?? "",
      content: note.content ?? "",
      tag: (note.tag ?? "otro") as NoteTag,
      isPinned: note.isPinned ?? false,
    });
    setIsNewNote(false);
  };

  const closeEditor = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setEditingNote(null);
    setIsNewNote(false);
  };

  const saveCurrentNote = async (note: EditingNote) => {
    if (note.id) {
      await updateNote.mutateAsync({
        id: note.id,
        title: note.title,
        content: note.content,
        tag: note.tag,
        isPinned: note.isPinned,
      });
    } else {
      const created = await createNote.mutateAsync({
        title: note.title,
        content: note.content,
        tag: note.tag,
        isPinned: note.isPinned,
      });
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

  const handleTogglePin = async (id: number, current: boolean) => {
    await updateNote.mutateAsync({ id, isPinned: !current });
    refetch();
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Notas</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm bg-foreground text-background px-3 py-1.5 rounded-md hover:bg-foreground/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </button>
      </div>

      {/* ── Editor inline ── */}
      {editingNote && (
        <div className="border border-border rounded-lg bg-card p-4 space-y-3 animate-fade-in-up">
          {/* Barra superior del editor */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={editingNote.tag}
              onChange={(e) => handleFieldChange("tag", e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background text-muted-foreground focus:outline-none focus:border-foreground/30 cursor-pointer"
            >
              {TAG_OPTIONS.filter((t) => t.value !== "todas").map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={handleDelete}
                disabled={!editingNote.id}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-30"
                title="Eliminar nota"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={closeEditor}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Título */}
          <input
            type="text"
            value={editingNote.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            placeholder="Título (opcional)"
            className="w-full text-sm font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
          />

          {/* Contenido */}
          <textarea
            ref={editorRef}
            value={editingNote.content}
            onChange={(e) => handleFieldChange("content", e.target.value)}
            placeholder="Escribe aquí..."
            className="w-full text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none min-h-[120px]"
            rows={5}
          />

          {/* Indicador de guardado */}
          <p className="text-xs text-muted-foreground/60">
            {updateNote.isPending || createNote.isPending ? "Guardando..." : isNewNote && !editingNote.id ? "Escribe para guardar automáticamente" : "Guardado"}
          </p>
        </div>
      )}

      {/* ── Búsqueda ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar notas..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/30 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Filtro de tags ── */}
      <div className="flex gap-1.5 flex-wrap">
        {TAG_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTagFilter(opt.value)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer",
              tagFilter === opt.value
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Lista de notas ── */}
      {allNotes.length === 0 && !editingNote ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">Aún no tienes notas.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Crea una para guardar ideas, recordatorios o cualquier cosa.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin resultados</p>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Fijadas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {pinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    id={note.id}
                    title={note.title ?? ""}
                    content={note.content ?? ""}
                    tag={(note.tag ?? "otro") as NoteTag}
                    isPinned={note.isPinned ?? false}
                    updatedAt={note.updatedAt}
                    onClick={() => openExisting(note)}
                    onTogglePin={() => handleTogglePin(note.id, note.isPinned ?? false)}
                  />
                ))}
              </div>
            </div>
          )}

          {unpinned.length > 0 && (
            <div className="space-y-2">
              {pinned.length > 0 && <p className="text-xs text-muted-foreground uppercase tracking-wider">Resto</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {unpinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    id={note.id}
                    title={note.title ?? ""}
                    content={note.content ?? ""}
                    tag={(note.tag ?? "otro") as NoteTag}
                    isPinned={note.isPinned ?? false}
                    updatedAt={note.updatedAt}
                    onClick={() => openExisting(note)}
                    onTogglePin={() => handleTogglePin(note.id, note.isPinned ?? false)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
