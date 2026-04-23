/**
 * Texto compacto de Apuntes para inyectar en el system prompt de los asesores.
 * Notas archivadas y planes completados/archivados se excluyen para ahorrar tokens.
 */

type NoteRow = {
  id: number;
  title: string;
  content: string;
  tag: string;
  isArchived?: boolean | null;
};

type ActionRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  tipo: string;
  agentId: string;
  priority: string;
  metrica: string | null;
  valorObjetivo: string | null;
  deadline: Date | null;
  isArchived?: boolean | null;
};

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildAdvisorApuntesContext(params: { notes: NoteRow[]; actionItems: ActionRow[] }): string | null {
  const notes = params.notes.filter((n) => !n.isArchived);
  const plans = params.actionItems.filter(
    (i) => !i.isArchived && (i.status === "pendiente" || i.status === "en_progreso")
  );

  if (notes.length === 0 && plans.length === 0) return null;

  const parts: string[] = [];

  if (notes.length > 0) {
    const maxNotes = 18;
    const bodyMax = 420;
    const titleMax = 100;
    parts.push("NOTAS (activas):");
    for (const n of notes.slice(0, maxNotes)) {
      const title = clip(n.title || "(sin título)", titleMax);
      const body = clip(n.content || "", bodyMax);
      parts.push(`- [${n.tag}] ${title}: ${body}`);
    }
    if (notes.length > maxNotes) {
      parts.push(`… y ${notes.length - maxNotes} nota(s) más (omitidas por brevedad).`);
    }
  }

  if (plans.length > 0) {
    parts.push("");
    parts.push("TAREAS Y HÁBITOS EN CURSO (no completados ni archivados):");
    const maxPlans = 28;
    for (const i of plans.slice(0, maxPlans)) {
      const tipo = i.tipo === "habito" ? "hábito" : "tarea";
      const dlTs = i.deadline instanceof Date && !Number.isNaN(i.deadline.getTime()) ? i.deadline.getTime() : null;
      const dl = dlTs != null ? ` · vence ${new Date(dlTs).toISOString().slice(0, 10)}` : "";
      const metric =
        i.metrica && i.valorObjetivo
          ? ` · ${i.metrica} → ${i.valorObjetivo}`
          : i.metrica
            ? ` · ${i.metrica}`
            : "";
      const desc = i.description ? ` — ${clip(i.description, 160)}` : "";
      parts.push(
        `- [${tipo} · ${i.agentId} · ${i.priority}] ${clip(i.title, 140)} (${i.status})${dl}${metric}${desc}`
      );
    }
    if (plans.length > maxPlans) {
      parts.push(`… y ${plans.length - maxPlans} ítem(s) más.`);
    }
  }

  return parts.join("\n");
}
