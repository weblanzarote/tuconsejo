import {
  integer,
  sqliteTable,
  text,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Usuarios ─────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  onboardingCompleted: integer("onboardingCompleted", { mode: "boolean" }).default(false).notNull(),
  guardianEnabled: integer("guardianEnabled", { mode: "boolean" }).default(false).notNull(),
  valuesFrameworkName: text("valuesFrameworkName"),
  emailFilterPrefs: text("emailFilterPrefs"),
  autoSyncEnabled: integer("autoSyncEnabled", { mode: "boolean" }).default(true).notNull(),
  /** IANA, p. ej. Europe/Madrid — define el "día civil" del diario en servidor y cliente */
  timezone: text("timezone"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── La Bóveda (Fuente única de verdad del usuario) ──────────────────────────
export const vault = sqliteTable("vault", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  financialStatus: text("financialStatus", { mode: "json" }),
  careerData: text("careerData", { mode: "json" }),
  healthMetrics: text("healthMetrics", { mode: "json" }),
  relationshipStatus: text("relationshipStatus", { mode: "json" }),
  familyCircle: text("familyCircle", { mode: "json" }),
  valuesFramework: text("valuesFramework", { mode: "json" }),
  personalInfo: text("personalInfo", { mode: "json" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type Vault = typeof vault.$inferSelect;
export type InsertVault = typeof vault.$inferInsert;

// ─── Conversaciones ───────────────────────────────────────────────────────────
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  agentId: text("agentId", {
    enum: ["economia", "carrera", "salud", "relaciones", "familia", "guardian", "encuestador", "sala_juntas"],
  }).notNull(),
  title: text("title"),
  messageCount: integer("messageCount").default(0).notNull(),
  summary: text("summary"),
  lastSummaryAt: integer("lastSummaryAt"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ─── Mensajes ─────────────────────────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversationId").notNull(),
  userId: integer("userId").notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  agentId: text("agentId", {
    enum: ["economia", "carrera", "salud", "relaciones", "familia", "guardian", "encuestador", "sala_juntas"],
  }),
  structuredData: text("structuredData", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Plan de Acción / Tareas ──────────────────────────────────────────────────
export const actionItems = sqliteTable("action_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  conversationId: integer("conversationId"),
  agentId: text("agentId", {
    enum: ["economia", "carrera", "salud", "relaciones", "familia", "guardian", "encuestador", "sala_juntas"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: ["alta", "media", "baja"] }).default("media").notNull(),
  status: text("status", {
    enum: ["pendiente", "en_progreso", "completada", "cancelada"],
  })
    .default("pendiente")
    .notNull(),
  tipo: text("tipo", { enum: ["tarea", "habito"] }).default("tarea").notNull(),
  /** Oculto del contexto de asesores / pulso; distinto de completada */
  isArchived: integer("isArchived", { mode: "boolean" }).default(false).notNull(),
  deadline: integer("deadline", { mode: "timestamp_ms" }),
  metrica: text("metrica"),
  valorObjetivo: text("valorObjetivo"),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  sourceMessageId: integer("sourceMessageId"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

// ─── Memoria Contextual ───────────────────────────────────────────────────────
export const memoryEntries = sqliteTable("memory_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  agentId: text("agentId", {
    enum: ["economia", "carrera", "salud", "relaciones", "familia", "guardian", "encuestador", "sala_juntas"],
  }).notNull(),
  content: text("content").notNull(),
  importance: text("importance", { enum: ["alta", "media", "baja"] }).default("media").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = typeof memoryEntries.$inferInsert;

// ─── Entradas de Diario ───────────────────────────────────────────────────────
export const diaryEntries = sqliteTable("diary_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  content: text("content").notNull().default(""),
  locationData: text("locationData", { mode: "json" }),
  mood: text("mood", { enum: ["bien", "regular", "mal"] }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type InsertDiaryEntry = typeof diaryEntries.$inferInsert;

// ─── (usuarios: campo autoSyncEnabled añadido vía migración ALTER TABLE en db.ts) ──

// ─── Notas ────────────────────────────────────────────────────────────────────
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  tag: text("tag", { enum: ["idea", "recordatorio", "compra", "proyecto", "otro"] })
    .default("otro")
    .notNull(),
  isPinned: integer("isPinned", { mode: "boolean" }).default(false).notNull(),
  /** Fuera del contexto de asesores; la nota sigue visible en Apuntes */
  isArchived: integer("isArchived", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// ─── Integraciones de usuario (Google OAuth, Microsoft OAuth, IMAP) ──────────
// Cada fila = una cuenta de correo conectada. Un usuario puede tener varias.
export const userIntegrations = sqliteTable("user_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  provider: text("provider", { enum: ["google", "microsoft", "imap"] }).notNull(),
  connectedEmail: text("connectedEmail").notNull(),
  label: text("label"), // ej: "Trabajo", "Personal"

  // Campos OAuth (google, microsoft)
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiry: integer("tokenExpiry", { mode: "timestamp_ms" }),

  // Campos IMAP/SMTP (cifrados en reposo)
  imapHost: text("imapHost"),
  imapPort: integer("imapPort"),
  imapUsername: text("imapUsername"),
  imapPasswordEncrypted: text("imapPasswordEncrypted"),
  smtpHost: text("smtpHost"),
  smtpPort: integer("smtpPort"),
  smtpSecure: integer("smtpSecure", { mode: "boolean" }).default(true),

  // Preferencias de filtrado específicas de esta cuenta (prompt adicional para el clasificador IA)
  emailFilterPrefs: text("emailFilterPrefs"),

  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = typeof userIntegrations.$inferInsert;

// ─── Señales de Email ─────────────────────────────────────────────────────────
export const emailSignals = sqliteTable("email_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  integrationId: integer("integrationId"), // FK a user_integrations
  gmailMessageId: text("gmailMessageId").notNull(),
  subject: text("subject").notNull().default(""),
  fromAddress: text("fromAddress").notNull().default(""),
  fromName: text("fromName").notNull().default(""),
  snippet: text("snippet").notNull().default(""),
  fullBody: text("fullBody"),
  receivedAt: integer("receivedAt", { mode: "timestamp_ms" }),
  status: text("status", {
    enum: ["pending", "replied", "ignored", "converted", "archived"],
  })
    .default("pending")
    .notNull(),
  draftReply: text("draftReply"),
  taskId: integer("taskId"),
  googleCalendarEventId: text("googleCalendarEventId"),
  /** Feedback del usuario sobre la clasificación IA: acierto o falso positivo */
  classifierUserFeedback: text("classifierUserFeedback", {
    enum: ["spot_on", "not_important"],
  }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type EmailSignal = typeof emailSignals.$inferSelect;
export type InsertEmailSignal = typeof emailSignals.$inferInsert;

// ─── Caché Pulso del día (resumen IA por día + hash de entradas) ─────────────
export const pulseDayCache = sqliteTable(
  "pulse_day_cache",
  {
    userId: integer("userId").notNull(),
    date: text("date").notNull(),
    contextHash: text("contextHash").notNull(),
    summary: text("summary").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date] }),
  })
);

export type PulseDayCacheRow = typeof pulseDayCache.$inferSelect;

// ─── Movimientos bancarios importados (p. ej. CaixaBank .xls) ─────────────────
export const bankMovements = sqliteTable("bank_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  bookedDate: text("bookedDate").notNull(),
  valueDate: text("valueDate"),
  description: text("description").notNull(),
  extra: text("extra"),
  amount: real("amount").notNull(),
  balance: real("balance"),
  source: text("source").notNull().default("caixa_xls"),
  importedAt: integer("importedAt", { mode: "timestamp_ms" }).notNull(),
});

export type BankMovement = typeof bankMovements.$inferSelect;
export type InsertBankMovement = typeof bankMovements.$inferInsert;

export const bankImportState = sqliteTable("bank_import_state", {
  userId: integer("userId").primaryKey(),
  accountHint: text("accountHint"),
  fileName: text("fileName"),
  lastImportedAt: integer("lastImportedAt", { mode: "timestamp_ms" }).notNull(),
  movementCount: integer("movementCount").notNull().default(0),
});

export type BankImportState = typeof bankImportState.$inferSelect;

// ─── Ajustes de Notificaciones (Telegram) ────────────────────────────────────
export const notificationSettings = sqliteTable("notification_settings", {
  userId: integer("userId").primaryKey(),
  telegramChatId: text("telegramChatId"),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  /** Frecuencia para correos importantes: instant | hourly | daily | off */
  emailFrequency: text("emailFrequency", {
    enum: ["instant", "hourly", "daily", "off"],
  })
    .default("instant")
    .notNull(),
  /** Frecuencia para tareas (creación / recordatorios de deadline): instant | daily | off */
  taskFrequency: text("taskFrequency", { enum: ["instant", "daily", "off"] })
    .default("instant")
    .notNull(),
  /** Hora local para el resumen diario, HH:MM (usa la timezone del usuario) */
  dailyDigestTime: text("dailyDigestTime").default("09:00").notNull(),
  /** Marca ISO YYYY-MM-DD del último día en que se envió el resumen, para no duplicar */
  lastDailyDigestDate: text("lastDailyDigestDate"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;

// ─── Cola de notificaciones pendientes (para batching por frecuencia) ────────
export const notificationQueue = sqliteTable("notification_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  kind: text("kind", { enum: ["email", "task_new", "task_due"] }).notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  /** Referencia opcional al objeto origen (p. ej. emailSignals.id o actionItems.id) */
  refId: integer("refId"),
  /** Clave de deduplicación para evitar enviar dos veces el mismo recordatorio */
  dedupeKey: text("dedupeKey"),
  status: text("status", { enum: ["pending", "sent", "failed"] })
    .default("pending")
    .notNull(),
  sentAt: integer("sentAt", { mode: "timestamp_ms" }),
  lastError: text("lastError"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export type NotificationQueueRow = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueueRow = typeof notificationQueue.$inferInsert;
