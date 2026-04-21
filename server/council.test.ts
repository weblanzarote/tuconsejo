import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock de la base de datos para evitar conexiones reales
vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  getVaultByUserId: vi.fn().mockResolvedValue(null),
  upsertVault: vi.fn().mockResolvedValue(undefined),
  updateUserOnboarding: vi.fn().mockResolvedValue(undefined),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getOrCreateConversation: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    agentId: "economia",
    messageCount: 0,
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  insertMessage: vi.fn().mockResolvedValue(undefined),
  incrementMessageCount: vi.fn().mockResolvedValue(undefined),
  updateConversationSummary: vi.fn().mockResolvedValue(undefined),
  getMemoryByAgent: vi.fn().mockResolvedValue([]),
  insertMemoryEntry: vi.fn().mockResolvedValue(undefined),
  getActionItemsByUser: vi.fn().mockResolvedValue([]),
  insertActionItem: vi.fn().mockResolvedValue({ id: 1 }),
  updateActionItemStatus: vi.fn().mockResolvedValue(undefined),
  deleteActionItem: vi.fn().mockResolvedValue(undefined),
}));

// Mock del LLM para evitar llamadas reales a la API
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Esta es una respuesta de prueba del asesor de IA.",
        },
      },
    ],
  }),
}));

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Usuario de Prueba",
    loginMethod: "manus",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Tests de Autenticación ───────────────────────────────────────────────────
describe("auth", () => {
  it("me devuelve el usuario autenticado", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Usuario de Prueba");
  });

  it("logout limpia la cookie de sesión y devuelve success", async () => {
    const clearedCookies: string[] = [];
    const ctx = createMockContext({
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as unknown as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

// ─── Tests de La Bóveda ───────────────────────────────────────────────────────
describe("vault", () => {
  it("get devuelve null cuando no hay datos de bóveda", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vault.get();
    expect(result).toBeNull();
  });

  it("update acepta datos parciales sin error", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vault.update({
        personalInfo: { nombre: "Test", edad: "30" },
      })
    ).resolves.not.toThrow();
  });
});

// ─── Tests de Conversaciones ──────────────────────────────────────────────────
describe("conversations", () => {
  it("list devuelve array vacío cuando no hay conversaciones", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.conversations.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getMessages devuelve conversación y mensajes vacíos para agente nuevo", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.conversations.getMessages({ agentId: "economia" });
    expect(result).toBeDefined();
    expect(result.conversation).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
  });
});

// ─── Tests del Plan de Acción ─────────────────────────────────────────────────
describe("actionPlan", () => {
  it("list devuelve array vacío cuando no hay items", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.actionPlan.list({ agentId: undefined });
    expect(Array.isArray(result)).toBe(true);
  });

  it("add crea un nuevo item de acción", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.actionPlan.add({
        agentId: "carrera",
        title: "Actualizar CV",
        description: "Revisar y actualizar el CV con los últimos proyectos",
        priority: "alta",
      })
    ).resolves.not.toThrow();
  });
});

// ─── Tests de Agentes ─────────────────────────────────────────────────────────
describe("agents", () => {
  it("list devuelve los 7 asesores (6 dominios + encuestadora)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
  });

  it("los agentes tienen los campos requeridos", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.agents.list();
    for (const agent of agents) {
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("nombre");
      expect(agent).toHaveProperty("dominio");
      expect(agent).toHaveProperty("emoji");
    }
  });

  it("los IDs de agentes son los esperados", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.agents.list();
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("economia");
    expect(ids).toContain("carrera");
    expect(ids).toContain("salud");
    expect(ids).toContain("relaciones");
    expect(ids).toContain("familia");
    expect(ids).toContain("guardian");
  });
});
