// Definición de agentes para el frontend (sin system prompts)
export type AgentId =
  | "economia"
  | "carrera"
  | "salud"
  | "relaciones"
  | "familia"
  | "guardian"
  | "encuestador"
  | "sala_juntas";

export interface AgentInfo {
  id: AgentId;
  nombre: string;
  titulo: string;
  dominio: string;
  emoji: string;
  color: string;
  colorHex: string;
  descripcion: string;
}

export const AGENT_COLORS: Record<AgentId, string> = {
  economia: "#10b981",
  carrera: "#3b82f6",
  salud: "#f43f5e",
  relaciones: "#ec4899",
  familia: "#f59e0b",
  guardian: "#8b5cf6",
  encuestador: "#14b8a6",
  sala_juntas: "#06b6d4",
};

export const AGENT_EMOJIS: Record<AgentId, string> = {
  economia: "💰",
  carrera: "🚀",
  salud: "💪",
  relaciones: "❤️",
  familia: "👨‍👩‍👧‍👦",
  guardian: "🔮",
  encuestador: "📋",
  sala_juntas: "🏛️",
};

export const AGENT_NAMES: Record<AgentId, string> = {
  economia: "Alejandro",
  carrera: "Valentina",
  salud: "Dr. Marcos",
  relaciones: "Sofía",
  familia: "Elena",
  guardian: "El Guardián",
  encuestador: "Lucía",
  sala_juntas: "Sala de Juntas",
};

export const AGENT_DOMAINS: Record<AgentId, string> = {
  economia: "Economía & Riqueza",
  carrera: "Carrera & Talento",
  salud: "Salud & Vitalidad",
  relaciones: "Relaciones Íntimas",
  familia: "Círculo & Familia",
  guardian: "Valores & Propósito",
  encuestador: "Perfil progresivo",
  sala_juntas: "Debate Colectivo",
};

export const MAIN_AGENTS: AgentId[] = [
  "economia",
  "carrera",
  "salud",
  "relaciones",
  "familia",
  "guardian",
];

/** Asesores con chat individual (incluye a Lucía, la encuestadora) */
export const CHAT_SELECTOR_AGENTS: AgentId[] = [...MAIN_AGENTS, "encuestador"];

/** Tabs del selector de chat: incluye "Todos" (sala_juntas) al inicio */
export const CHAT_TABS: AgentId[] = ["sala_juntas", ...CHAT_SELECTOR_AGENTS];

export function getAgentColor(agentId: AgentId): string {
  return AGENT_COLORS[agentId] ?? "#8b5cf6";
}

export function getAgentEmoji(agentId: AgentId): string {
  return AGENT_EMOJIS[agentId] ?? "🤖";
}

export function getAgentName(agentId: AgentId): string {
  return AGENT_NAMES[agentId] ?? agentId;
}
