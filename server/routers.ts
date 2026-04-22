import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { AGENT_LIST, buildCheckinPrompt, buildSystemPrompt, getAgentById, type AgentId } from "./agents";
import {
  deleteActionItem,
  getActionItemsByUser,
  getConversationsByUser,
  getMemoryByAgent,
  getMessagesByConversation,
  getOrCreateConversation,
  getVaultByUserId,
  incrementMessageCount,
  insertActionItem,
  insertMemoryEntry,
  insertMessage,
  updateActionItemStatus,
  updateConversationSummary,
  updateUserOnboarding,
  updateUserTimezone,
  upsertVault,
  getDiaryEntry,
  upsertDiaryEntry,
  getRecentDiaryEntries,
  searchDiaryEntries,
  getDiaryEntriesByMonth,
  getNotesByUser,
  getNoteById,
  insertNote,
  updateNote,
  deleteNote,
  searchNotes,
  getIntegrationsByUser,
  getIntegrationById,
  insertImapIntegration,
  deleteIntegrationById,
  insertEmailSignal,
  getEmailSignalsByUser,
  getEmailSignalById,
  updateEmailSignalStatus,
  getPendingSignalCount,
  getEmailFilterPrefs,
  setEmailFilterPrefs,
  setIntegrationFilterPrefs,
  updateActionItemTipo,
  setEmailSignalClassifierFeedback,
  getRecentClassifierFeedbackExamples,
} from "./db";
import { getProvider, createCalendarEventForIntegration } from "./providers";
import { syncUserEmails } from "./emailSync";
import { testImapConnection } from "./providers/imap";
import { encrypt } from "./crypto-utils";
import { formatYyyyMmDdInTimeZone } from "./dateTz";

const AgentIdSchema = z.enum([
  "economia",
  "carrera",
  "salud",
  "relaciones",
  "familia",
  "guardian",
  "encuestador",
  "sala_juntas",
]);

// ─── Router de Autenticación ──────────────────────────────────────────────────
// Nota: login/register/logout se manejan en /api/auth/* (auth-local.ts)
// Este router solo expone el usuario actual vía tRPC para el frontend
const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    // La cookie se limpia en /api/auth/logout — aquí solo confirmamos
    ctx.res.clearCookie("cs_session", { path: "/" });
    return { success: true } as const;
  }),
  updateTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(3).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserTimezone(ctx.user.id, input.timezone);
      return { success: true as const };
    }),
});

// ─── Router de La Bóveda ──────────────────────────────────────────────────────
const vaultRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getVaultByUserId(ctx.user.id);
  }),

  update: protectedProcedure
    .input(
      z.object({
        financialStatus: z.any().optional(),
        careerData: z.any().optional(),
        healthMetrics: z.any().optional(),
        relationshipStatus: z.any().optional(),
        familyCircle: z.any().optional(),
        valuesFramework: z.any().optional(),
        personalInfo: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertVault(ctx.user.id, input);
      return { success: true };
    }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        personalInfo: z.any(),
        financialStatus: z.any().optional(),
        careerData: z.any().optional(),
        healthMetrics: z.any().optional(),
        relationshipStatus: z.any().optional(),
        familyCircle: z.any().optional(),
        valuesFramework: z.any().optional(),
        guardianEnabled: z.boolean().optional(),
        guardianFramework: z.string().optional(),
        timezone: z.string().min(3).max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guardianEnabled = input.guardianEnabled ?? false;
      const guardianFramework = input.guardianFramework;
      const tz = input.timezone?.trim();
      await upsertVault(ctx.user.id, {
        personalInfo: input.personalInfo,
        financialStatus: input.financialStatus ?? {},
        careerData: input.careerData ?? {},
        healthMetrics: input.healthMetrics ?? {},
        relationshipStatus: input.relationshipStatus ?? {},
        familyCircle: input.familyCircle ?? {},
        valuesFramework: input.valuesFramework,
      });
      await updateUserOnboarding(ctx.user.id, {
        onboardingCompleted: true,
        guardianEnabled,
        valuesFrameworkName: guardianFramework?.trim() ? guardianFramework : undefined,
        timezone: tz ? tz : undefined,
      });
      return { success: true };
    }),
});

// ─── Router de Conversaciones ─────────────────────────────────────────────────
const conversationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getConversationsByUser(ctx.user.id);
  }),

  getMessages: protectedProcedure
    .input(z.object({ agentId: AgentIdSchema }))
    .query(async ({ ctx, input }) => {
      const conv = await getOrCreateConversation(ctx.user.id, input.agentId);
      if (!conv) return { conversation: null, messages: [] };
      const msgs = await getMessagesByConversation(conv.id);
      return { conversation: conv, messages: msgs };
    }),
});

// ─── Router de Chat ───────────────────────────────────────────────────────────
const chatRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        agentId: AgentIdSchema,
        content: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { agentId, content } = input;
      const userId = ctx.user.id;

      // Obtener o crear conversación
      const conv = await getOrCreateConversation(userId, agentId);
      if (!conv) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la conversación" });

      // Guardar mensaje del usuario
      await insertMessage({
        conversationId: conv.id,
        userId,
        role: "user",
        content,
        agentId,
      });

      // Obtener historial de mensajes (últimos 20)
      const history = await getMessagesByConversation(conv.id, 20);

      // Obtener datos de La Bóveda
      const vaultData = await getVaultByUserId(userId);

      // Obtener memoria del agente
      const memories = await getMemoryByAgent(userId, agentId, 5);
      const memoryContext = memories.length > 0
        ? memories.map((m) => m.content).join("\n")
        : null;

      // Obtener planes activos de otros agentes (conciencia cruzada)
      const userConvs = await getConversationsByUser(userId);
      const otherAgentsPlans = userConvs
        .filter((c) => c.agentId !== agentId && c.summary)
        .map((c) => `[${c.agentId.toUpperCase()}]: ${c.summary}`)
        .join("\n");

      // Obtener datos del usuario para el Guardián
      const guardianFramework = ctx.user.valuesFrameworkName ?? null;

      // Construir system prompt
      const systemPrompt = buildSystemPrompt(
        agentId,
        vaultData as Record<string, unknown> | null,
        otherAgentsPlans || null,
        guardianFramework
      );

      // Construir historial de mensajes para la IA
      const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Agregar resumen de conversación si existe
      if (conv.summary) {
        llmMessages.push({
          role: "system",
          content: `RESUMEN DE CONVERSACIÓN ANTERIOR:\n${conv.summary}`,
        });
      }

      // Agregar memoria contextual
      if (memoryContext) {
        llmMessages.push({
          role: "system",
          content: `MEMORIA CONTEXTUAL:\n${memoryContext}`,
        });
      }

      // Agregar historial reciente (excluyendo el mensaje que acabamos de insertar)
      const recentHistory = history.slice(-19); // últimos 19 + el actual = 20
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          llmMessages.push({ role: msg.role, content: msg.content });
        }
      }

      // Llamar a la IA
      const response = await invokeLLM({ messages: llmMessages });
      const rawContent = response.choices[0]?.message?.content;
      const assistantContent = typeof rawContent === "string" ? rawContent : "Lo siento, no pude generar una respuesta.";

      // Intentar extraer datos estructurados del JSON en la respuesta
      let structuredData: unknown = null;
      const jsonMatch = assistantContent.match(/```json\n?([\s\S]*?)\n?```/) ||
        assistantContent.match(/\{[\s\S]*?"actionItems"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] ?? jsonMatch[0];
          structuredData = JSON.parse(jsonStr);
        } catch {
          // No hay JSON válido, ignorar
        }
      }

      // Guardar respuesta del asistente
      const assistantMsg = await insertMessage({
        conversationId: conv.id,
        userId,
        role: "assistant",
        content: assistantContent,
        agentId,
        structuredData,
      });

      // Incrementar contador de mensajes
      await incrementMessageCount(conv.id);
      const newCount = (conv.messageCount ?? 0) + 2; // usuario + asistente

      // Poda de memoria: resumir cada 10 mensajes
      if (newCount > 0 && newCount % 10 === 0) {
        const allMessages = await getMessagesByConversation(conv.id, 30);
        const summaryPrompt = `Resume en 3-5 puntos clave la siguiente conversación entre el usuario y el asesor ${agentId}. Enfócate en los temas principales, decisiones tomadas y compromisos adquiridos:\n\n${allMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n")}`;
        const summaryResponse = await invokeLLM({
          messages: [
            { role: "system", content: "Eres un asistente que resume conversaciones de forma concisa y estructurada en español." },
            { role: "user", content: summaryPrompt },
          ],
        });
        const rawSummary = summaryResponse.choices[0]?.message?.content;
        const summary = typeof rawSummary === "string" ? rawSummary : "";
        if (summary) {
          await updateConversationSummary(conv.id, summary, newCount);
          await insertMemoryEntry({
            userId,
            agentId,
            content: summary,
            importance: "alta",
          });
        }
      }

      return {
        message: assistantMsg,
        structuredData,
      };
    }),
});

// ─── Router de Plan de Acción ─────────────────────────────────────────────────
const actionPlanRouter = router({
  list: protectedProcedure
    .input(z.object({ agentId: AgentIdSchema.optional() }))
    .query(async ({ ctx, input }) => {
      return getActionItemsByUser(ctx.user.id, input.agentId as AgentId | undefined);
    }),

  add: protectedProcedure
    .input(
      z.object({
        agentId: AgentIdSchema,
        title: z.string().min(1).max(512),
        description: z.string().optional(),
        priority: z.enum(["alta", "media", "baja"]).optional(),
        deadline: z.string().optional(), // ISO date string
        metrica: z.string().optional(),
        valorObjetivo: z.string().optional(),
        conversationId: z.number().optional(),
        sourceMessageId: z.number().optional(),
        tipo: z.enum(["tarea", "habito"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deadline = input.deadline ? new Date(input.deadline) : undefined;
      return insertActionItem({
        userId: ctx.user.id,
        agentId: input.agentId as AgentId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        deadline,
        metrica: input.metrica,
        valorObjetivo: input.valorObjetivo,
        conversationId: input.conversationId,
        sourceMessageId: input.sourceMessageId,
        tipo: input.tipo ?? "tarea",
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        status: z.enum(["pendiente", "en_progreso", "completada", "cancelada"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateActionItemStatus(input.itemId, ctx.user.id, input.status);
      return { success: true };
    }),

  updateTipo: protectedProcedure
    .input(z.object({ itemId: z.number(), tipo: z.enum(["tarea", "habito"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateActionItemTipo(input.itemId, ctx.user.id, input.tipo);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteActionItem(input.itemId, ctx.user.id);
      return { success: true };
    }),
});

// ─── Router de Sala de Juntas ─────────────────────────────────────────────────
const boardroomRouter = router({
  debate: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const vaultData = await getVaultByUserId(userId);
      const userConvs = await getConversationsByUser(userId);
      const agentPlans = userConvs
        .filter((c) => c.summary)
        .map((c) => `[${c.agentId.toUpperCase()}]: ${c.summary}`)
        .join("\n");

      const systemPrompt = buildSystemPrompt("sala_juntas", vaultData as Record<string, unknown> | null, agentPlans || null, null);

      // Guardar en conversación de sala de juntas
      const conv = await getOrCreateConversation(userId, "sala_juntas");
      if (conv) {
        await insertMessage({ conversationId: conv.id, userId, role: "user", content: input.query, agentId: "sala_juntas" });
      }

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.query },
        ],
      });

      const rawBoardContent = response.choices[0]?.message?.content;
      const content =
        typeof rawBoardContent === "string" && rawBoardContent.trim().length > 0
          ? rawBoardContent
          : "No se pudo generar el debate.";

      let structuredData: unknown = null;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*?"perspectivas"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          structuredData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
        } catch { /* ignorar */ }
      }

      if (conv) {
        await insertMessage({ conversationId: conv.id, userId, role: "assistant", content, agentId: "sala_juntas", structuredData });
        await incrementMessageCount(conv.id);
      }

      return { content, structuredData };
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const conv = await getOrCreateConversation(ctx.user.id, "sala_juntas");
    if (!conv) return { conversation: null, messages: [] };
    const msgs = await getMessagesByConversation(conv.id, 30);
    return { conversation: conv, messages: msgs };
  }),

  checkin: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const vaultData = await getVaultByUserId(userId);
    const allItems = await getActionItemsByUser(userId);
    const activeItems = allItems
      .filter((i) => i.status === "pendiente" || i.status === "en_progreso")
      .map((i) => ({
        agentId: i.agentId,
        title: i.title,
        status: i.status,
        priority: i.priority,
        metrica: i.metrica,
        valorObjetivo: i.valorObjetivo,
      }));

    const systemPrompt = buildCheckinPrompt(activeItems, vaultData as Record<string, unknown> | null);
    const userMessage = "Realiza el check-in semanal de todos mis planes activos.";

    const conv = await getOrCreateConversation(userId, "sala_juntas");
    await insertMessage({ conversationId: conv.id, userId, role: "user", content: userMessage, agentId: "sala_juntas" });

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === "string" && rawContent.trim().length > 0
      ? rawContent
      : "No se pudo generar el check-in.";

    let structuredData: unknown = null;
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*?"perspectivas"[\s\S]*?\}/);
    if (jsonMatch) {
      try { structuredData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]); } catch { /* ignorar */ }
    }

    await insertMessage({ conversationId: conv.id, userId, role: "assistant", content, agentId: "sala_juntas", structuredData });
    await incrementMessageCount(conv.id);

    return { content, structuredData };
  }),
});

// ─── Router de Diario ─────────────────────────────────────────────────────────
const diaryRouter = router({
  getEntry: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return getDiaryEntry(ctx.user.id, input.date);
    }),

  upsertEntry: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        content: z.string().max(50000).optional(),
        mood: z.enum(["bien", "regular", "mal"]).nullable().optional(),
        locationData: z
          .array(
            z.object({
              name: z.string(),
              lat: z.number().optional(),
              lng: z.number().optional(),
              time: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { date, ...data } = input;
      return upsertDiaryEntry(ctx.user.id, date, data);
    }),

  listRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      return getRecentDiaryEntries(ctx.user.id, input.limit);
    }),

  listMonth: protectedProcedure
    .input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return getDiaryEntriesByMonth(ctx.user.id, input.yearMonth);
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      return searchDiaryEntries(ctx.user.id, input.query);
    }),
});

// ─── Router de Notas ──────────────────────────────────────────────────────────
const notesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotesByUser(ctx.user.id);
  }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      return searchNotes(ctx.user.id, input.query);
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().max(512).default(""),
        content: z.string().max(50000).default(""),
        tag: z.enum(["idea", "recordatorio", "compra", "proyecto", "otro"]).default("otro"),
        isPinned: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return insertNote(ctx.user.id, input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().max(512).optional(),
        content: z.string().max(50000).optional(),
        tag: z.enum(["idea", "recordatorio", "compra", "proyecto", "otro"]).optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateNote(ctx.user.id, id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteNote(ctx.user.id, input.id);
      return { success: true };
    }),

  convertToTask: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        priority: z.enum(["alta", "media", "baja"]).optional(),
        deadline: z.string().optional(),
        agentId: AgentIdSchema.optional(),
        keepNote: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const note = await getNoteById(ctx.user.id, input.id);
      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Nota no encontrada" });

      const title = (note.title?.trim() || note.content.slice(0, 120).trim() || "Idea sin título");
      const description = note.title?.trim() ? note.content : undefined;

      const task = await insertActionItem({
        userId: ctx.user.id,
        agentId: (input.agentId as AgentId | undefined) ?? "guardian",
        title,
        description,
        priority: input.priority ?? "media",
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        tipo: "tarea",
      });

      if (!input.keepNote) {
        await deleteNote(ctx.user.id, input.id);
      }
      return { success: true, taskId: task?.id };
    }),
});

// ─── Router de Asesores (con enrutamiento inteligente) ────────────────────────
const advisorsRouter = router({
  // Predice qué asesores deben responder (sin efectos en DB)
  predict: protectedProcedure
    .input(z.object({ content: z.string().min(3).max(500) }))
    .query(async ({ input }) => {
      const routingPrompt = `Dado este mensaje, selecciona los 1-3 asesores MÁS relevantes de esta lista:
- economia: finanzas, dinero, ahorro, inversión, deudas, gastos
- carrera: trabajo, empleo, profesión, habilidades, desarrollo profesional
- salud: salud física, ejercicio, sueño, salud mental, estrés, bienestar
- relaciones: relaciones románticas, pareja, amor, intimidad, citas
- familia: familia, hijos, crianza, padres, amigos cercanos
- guardian: valores, propósito, ética, filosofía de vida, significado

Mensaje: "${input.content}"

Responde ÚNICAMENTE con JSON: {"advisors": ["id1", "id2"]}
Máximo 3 asesores. Sé selectivo.`;

      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: routingPrompt }],
          responseFormat: { type: "json_object" },
          maxTokens: 80,
        });
        const rawContent = response.choices[0]?.message?.content;
        const raw = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(raw) as { advisors?: string[] };
        const valid = ["economia", "carrera", "salud", "relaciones", "familia", "guardian"];
        const advisors = (parsed.advisors ?? ["guardian"])
          .filter((id) => valid.includes(id))
          .slice(0, 3);
        return { suggestedAgentIds: advisors.length > 0 ? advisors : ["guardian"] };
      } catch {
        return { suggestedAgentIds: ["guardian"] };
      }
    }),

  // Consulta a los asesores seleccionados y devuelve sus respuestas
  ask: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1).max(4000),
        agentIds: z.array(AgentIdSchema.exclude(["sala_juntas", "encuestador"])).min(1).max(6),
        diaryContext: z.string().optional(), // contexto del diario del día
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { content, agentIds, diaryContext } = input;
      const userId = ctx.user.id;

      const vaultData = await getVaultByUserId(userId);
      const userConvs = await getConversationsByUser(userId);
      const otherPlans = userConvs
        .filter((c) => c.summary)
        .map((c) => `[${c.agentId.toUpperCase()}]: ${c.summary}`)
        .join("\n");

      const guardianFramework = ctx.user.valuesFrameworkName ?? null;

      // Llamar a cada asesor en paralelo
      const responses = await Promise.all(
        agentIds.map(async (agentId) => {
          const conv = await getOrCreateConversation(userId, agentId);

          // Guardar mensaje del usuario
          await insertMessage({
            conversationId: conv.id,
            userId,
            role: "user",
            content,
            agentId,
          });

          // Construir system prompt (con contexto del diario si existe)
          let systemPrompt = buildSystemPrompt(
            agentId,
            vaultData as Record<string, unknown> | null,
            otherPlans || null,
            guardianFramework
          );

          if (diaryContext) {
            systemPrompt += `\n\nCONTEXTO DEL DIARIO DE HOY DEL USUARIO:\n${diaryContext}\nUsa este contexto para personalizar tu respuesta si es relevante.`;
          }

          // Historial reciente
          const history = await getMessagesByConversation(conv.id, 12);
          const memories = await getMemoryByAgent(userId, agentId, 3);

          const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
          ];
          if (conv.summary) {
            llmMessages.push({ role: "system", content: `RESUMEN PREVIO:\n${conv.summary}` });
          }
          if (memories.length > 0) {
            llmMessages.push({ role: "system", content: `MEMORIA:\n${memories.map((m) => m.content).join("\n")}` });
          }
          for (const msg of history.slice(-11)) {
            if (msg.role === "user" || msg.role === "assistant") {
              llmMessages.push({ role: msg.role, content: msg.content });
            }
          }

          const response = await invokeLLM({ messages: llmMessages });
          const rawContent = response.choices[0]?.message?.content;
          const assistantContent = typeof rawContent === "string" ? rawContent : "Lo siento, no pude responder.";

          // Extraer datos estructurados
          let structuredData: unknown = null;
          const jsonMatch =
            assistantContent.match(/```json\n?([\s\S]*?)\n?```/) ||
            assistantContent.match(/\{[\s\S]*?"actionItems"[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              structuredData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
            } catch { /* ignorar */ }
          }

          const assistantMsg = await insertMessage({
            conversationId: conv.id,
            userId,
            role: "assistant",
            content: assistantContent,
            agentId,
            structuredData,
          });
          await incrementMessageCount(conv.id);

          return { agentId, content: assistantContent, structuredData, messageId: assistantMsg.id };
        })
      );

      return { responses };
    }),
});

// ─── Router de Agentes (metadata) ────────────────────────────────────────────
const agentsRouter = router({
  list: publicProcedure.query(() => {
    return AGENT_LIST.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      titulo: a.titulo,
      dominio: a.dominio,
      emoji: a.emoji,
      color: a.color,
      colorHex: a.colorHex,
      descripcion: a.descripcion,
    }));
  }),
});

// ─── Router de Señales (Email) ────────────────────────────────────────────────
const signalsRouter = router({

  // Compat: estado de conexión Google (primera cuenta Google si existe)
  googleStatus: protectedProcedure.query(async ({ ctx }) => {
    const integrations = await getIntegrationsByUser(ctx.user.id);
    const google = integrations.find((i) => i.provider === "google");
    return { connected: !!google, email: google?.connectedEmail ?? null };
  }),

  // Listar cuentas conectadas (multi-cuenta: Google, Microsoft, IMAP)
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const integrations = await getIntegrationsByUser(ctx.user.id);
    return integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      email: i.connectedEmail,
      label: i.label ?? null,
      createdAt: i.createdAt,
    }));
  }),

  // Leer preferencias de filtro de email
  getEmailPrefs: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await getEmailFilterPrefs(ctx.user.id);
    return { prefs: prefs ?? "" };
  }),

  // Guardar preferencias de filtro de email
  setEmailPrefs: protectedProcedure
    .input(z.object({ prefs: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await setEmailFilterPrefs(ctx.user.id, input.prefs);
      return { success: true };
    }),

  // Leer preferencias de filtrado de una cuenta concreta
  getIntegrationPrefs: protectedProcedure
    .input(z.object({ integrationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const integration = await getIntegrationById(ctx.user.id, input.integrationId);
      if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      return { prefs: integration.emailFilterPrefs ?? "" };
    }),

  // Guardar preferencias de filtrado específicas de una cuenta
  setIntegrationPrefs: protectedProcedure
    .input(z.object({ integrationId: z.number(), prefs: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await setIntegrationFilterPrefs(ctx.user.id, input.integrationId, input.prefs);
      return { success: true };
    }),

  // Eliminar una cuenta conectada
  removeAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteIntegrationById(ctx.user.id, input.id);
      return { success: true };
    }),

  // Añadir cuenta IMAP/SMTP (valida antes de guardar)
  addImapAccount: protectedProcedure
    .input(
      z.object({
        connectedEmail: z.string().email(),
        label: z.string().max(80).optional(),
        imapHost: z.string().min(1),
        imapPort: z.number().int().min(1).max(65535).default(993),
        imapUsername: z.string().min(1),
        imapPassword: z.string().min(1),
        smtpHost: z.string().min(1),
        smtpPort: z.number().int().min(1).max(65535).default(587),
        smtpSecure: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const test = await testImapConnection({
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapUsername: input.imapUsername,
        imapPassword: input.imapPassword,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
      });
      if (!test.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: test.error ?? "Credenciales inválidas" });
      }
      const row = await insertImapIntegration(ctx.user.id, {
        connectedEmail: input.connectedEmail,
        label: input.label,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapUsername: input.imapUsername,
        imapPasswordEncrypted: encrypt(input.imapPassword),
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
      });
      return { id: row.id };
    }),

  // Sincronizar emails desde TODAS las cuentas conectadas
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const integrations = await getIntegrationsByUser(ctx.user.id);
    if (!integrations.length) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hay cuentas conectadas" });
    }
    return await syncUserEmails(ctx.user.id);
  }),

  // Listar señales
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return getEmailSignalsByUser(ctx.user.id, input.status);
    }),

  // Contador de señales pendientes (para badge en nav)
  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getPendingSignalCount(ctx.user.id);
    return { count };
  }),

  // Ignorar señal
  ignore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await updateEmailSignalStatus(ctx.user.id, input.id, "ignored");
      return { success: true };
    }),

  // Archivar señal (correo guardado para consulta, sin notificación)
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await updateEmailSignalStatus(ctx.user.id, input.id, "archived");
      return { success: true };
    }),

  // Mover correo archivado a pendiente de nuevo
  unarchive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await updateEmailSignalStatus(ctx.user.id, input.id, "pending");
      return { success: true };
    }),

  // Feedback sobre la clasificación IA (mejora el filtro en próximas sincronizaciones)
  setClassifierFeedback: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        verdict: z.enum(["spot_on", "not_important"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setEmailSignalClassifierFeedback(ctx.user.id, input.id, input.verdict);
      return { success: true };
    }),

  // Generar borrador de respuesta con IA
  draftReply: protectedProcedure
    .input(z.object({ id: z.number(), instruction: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const signal = await getEmailSignalById(userId, input.id);
      if (!signal) throw new TRPCError({ code: "NOT_FOUND", message: "Señal no encontrada" });

      const vaultData = await getVaultByUserId(userId);
      const personalInfo = vaultData?.personalInfo as any;
      const userName = personalInfo?.nombre ?? personalInfo?.name ?? "el usuario";

      const systemPrompt = `Eres el asistente personal de ${userName}. Tu tarea es redactar una respuesta de email profesional y natural en el idioma del email original.

Datos del usuario: ${JSON.stringify(vaultData ?? {})}

Email original:
- De: ${signal.fromName} <${signal.fromAddress}>
- Asunto: ${signal.subject}
- Contenido: ${(signal.fullBody ?? signal.snippet).slice(0, 1500)}

Instrucción del usuario: "${input.instruction}"

Redacta SOLO el cuerpo del email de respuesta. Sé conciso y natural. Sin encabezados ni firmas elaboradas — solo el texto del mensaje.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Genera la respuesta siguiendo la instrucción: ${input.instruction}` },
        ],
        maxTokens: 400,
      });

      const rawContent = response.choices[0]?.message?.content;
      const draft = typeof rawContent === "string" ? rawContent.trim() : "No pude generar el borrador.";

      await updateEmailSignalStatus(userId, input.id, "pending", { draftReply: draft });
      return { draft };
    }),

  // Enviar respuesta usando la cuenta de origen del email
  sendReply: protectedProcedure
    .input(z.object({ id: z.number(), draft: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const signal = await getEmailSignalById(userId, input.id);
      if (!signal) throw new TRPCError({ code: "NOT_FOUND", message: "Señal no encontrada" });
      if (!signal.integrationId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Señal sin cuenta asociada" });
      }
      const integration = await getIntegrationById(userId, signal.integrationId);
      if (!integration) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cuenta de origen no encontrada" });
      }

      const provider = getProvider(integration);
      // Recuperar el providerMessageId original (prefijado con "integrationId:")
      const [, ...rest] = signal.gmailMessageId.split(":");
      const originalId = rest.join(":") || signal.gmailMessageId;

      await provider.send(
        integration,
        signal.fromAddress,
        signal.subject.startsWith("Re:") ? signal.subject : `Re: ${signal.subject}`,
        input.draft,
        originalId
      );

      await updateEmailSignalStatus(userId, input.id, "replied");
      return { success: true };
    }),

  // Convertir señal en tarea
  convertToTask: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(512),
        description: z.string().optional(),
        priority: z.enum(["alta", "media", "baja"]).optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const signal = await getEmailSignalById(userId, input.id);
      if (!signal) throw new TRPCError({ code: "NOT_FOUND", message: "Señal no encontrada" });

      const deadline = input.deadline ? new Date(input.deadline) : undefined;
      const task = await insertActionItem({
        userId,
        agentId: "carrera",
        title: input.title,
        description: input.description ?? `Origen: email de ${signal.fromName} — ${signal.subject}`,
        priority: input.priority ?? "media",
        deadline,
      });

      await updateEmailSignalStatus(userId, input.id, "converted", { taskId: task.id });
      return { taskId: task.id };
    }),

  // Crear evento de calendario (Google o Microsoft, según integrationId)
  createCalendarEvent: protectedProcedure
    .input(
      z.object({
        integrationId: z.number().optional(),
        title: z.string().min(1),
        startDatetime: z.string(),
        endDatetime: z.string(),
        description: z.string().optional(),
        signalId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Determinar integración: explícita, la de la señal, o la primera Google/Microsoft
      let integrationId = input.integrationId;
      if (!integrationId && input.signalId) {
        const signal = await getEmailSignalById(userId, input.signalId);
        integrationId = signal?.integrationId ?? undefined;
      }

      let integration = integrationId ? await getIntegrationById(userId, integrationId) : null;
      if (!integration || (integration.provider !== "google" && integration.provider !== "microsoft")) {
        // Fallback: primera cuenta Google o Microsoft del usuario
        const all = await getIntegrationsByUser(userId);
        integration = all.find((i) => i.provider === "google" || i.provider === "microsoft") ?? null;
      }
      if (!integration) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Se requiere una cuenta Google o Microsoft para crear eventos",
        });
      }

      const event = await createCalendarEventForIntegration(integration, {
        title: input.title,
        startDatetime: input.startDatetime,
        endDatetime: input.endDatetime,
        description: input.description,
      });

      if (input.signalId) {
        await updateEmailSignalStatus(userId, input.signalId, "converted", {
          googleCalendarEventId: event.id,
        });
      }

      return { eventId: event.id, htmlLink: event.htmlLink };
    }),

  // Pulso del día — resumen IA de señales + tareas + diario
  pulseOfDay: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [pendingCount, topSignals, allItems, todayEntry] = await Promise.all([
      getPendingSignalCount(userId),
      getEmailSignalsByUser(userId, "pending").then((s) => s.slice(0, 3)),
      getActionItemsByUser(userId),
      getDiaryEntry(
        userId,
        formatYyyyMmDdInTimeZone(new Date(), ctx.user.timezone?.trim() || "UTC")
      ),
    ]);

    const activeItems = allItems
      .filter((i) => i.status === "pendiente" || i.status === "en_progreso")
      .slice(0, 5);

    // Si no hay datos relevantes, no generar resumen
    if (!pendingCount && !activeItems.length && !todayEntry?.mood) {
      return { summary: null };
    }

    const contextLines: string[] = [];
    if (pendingCount > 0) {
      contextLines.push(`- Tienes ${pendingCount} email${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""} de revisar.`);
      if (topSignals.length > 0) {
        contextLines.push(`  Los más recientes: ${topSignals.map((s) => `"${s.subject}" de ${s.fromName}`).join("; ")}.`);
      }
    }
    if (activeItems.length > 0) {
      contextLines.push(`- Tareas activas: ${activeItems.map((i) => i.title).join("; ")}.`);
    }
    if (todayEntry?.mood) {
      const moodText = { bien: "positivo", regular: "neutro", mal: "bajo" }[todayEntry.mood] ?? todayEntry.mood;
      contextLines.push(`- Tu estado de ánimo de hoy: ${moodText}.`);
    }

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente personal del usuario. Genera un resumen del día de 2-3 frases concisas y útiles en español, basándote en los datos proporcionados. Sé directo y alentador.",
          },
          { role: "user", content: contextLines.join("\n") },
        ],
        maxTokens: 150,
      });
      const rawContent = response.choices[0]?.message?.content;
      const summary = typeof rawContent === "string" ? rawContent.trim() : null;
      return { summary };
    } catch {
      return { summary: null };
    }
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  vault: vaultRouter,
  conversations: conversationsRouter,
  chat: chatRouter,
  actionPlan: actionPlanRouter,
  boardroom: boardroomRouter,
  agents: agentsRouter,
  diary: diaryRouter,
  notes: notesRouter,
  advisors: advisorsRouter,
  signals: signalsRouter,
});

export type AppRouter = typeof appRouter;
