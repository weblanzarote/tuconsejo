import { eq, and, asc, desc, or, like, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  users,
  vault,
  conversations,
  messages,
  actionItems,
  memoryEntries,
  diaryEntries,
  notes,
  pulseDayCache,
  bankMovements,
  bankImportState,
  userIntegrations,
  emailSignals,
  notificationSettings,
  notificationQueue,
  type InsertUser,
  type InsertVault,
  type InsertConversation,
  type InsertMessage,
  type InsertActionItem,
  type InsertMemoryEntry,
  type InsertDiaryEntry,
  type InsertNote,
  type InsertEmailSignal,
  type NotificationSettings,
  type InsertNotificationSettings,
  type NotificationQueueRow,
  type InsertNotificationQueueRow,
} from "../drizzle/schema";

// ─── Inicialización de la base de datos SQLite ────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "consejo.db");

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    // Crear el directorio si no existe
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sqlite = new Database(DB_PATH);
    // Activar WAL mode para mejor rendimiento
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite);
  }
  return _db;
}

// ─── Inicialización del esquema (crea tablas si no existen) ───────────────────
export function initializeDatabase() {
  const db = getDb();
  const sqlite = new Database(DB_PATH);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      onboardingCompleted INTEGER NOT NULL DEFAULT 0,
      guardianEnabled INTEGER NOT NULL DEFAULT 0,
      valuesFrameworkName TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS vault (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      financialStatus TEXT,
      careerData TEXT,
      healthMetrics TEXT,
      relationshipStatus TEXT,
      familyCircle TEXT,
      valuesFramework TEXT,
      personalInfo TEXT,
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      agentId TEXT NOT NULL,
      title TEXT,
      messageCount INTEGER NOT NULL DEFAULT 0,
      summary TEXT,
      lastSummaryAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agentId TEXT,
      structuredData TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      conversationId INTEGER,
      agentId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT 'pendiente',
      deadline INTEGER,
      metrica TEXT,
      valorObjetivo TEXT,
      completedAt INTEGER,
      sourceMessageId INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      agentId TEXT NOT NULL,
      content TEXT NOT NULL,
      importance TEXT NOT NULL DEFAULT 'media',
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      locationData TEXT,
      mood TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT 'otro',
      isPinned INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS user_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      provider TEXT NOT NULL DEFAULT 'google',
      connectedEmail TEXT NOT NULL DEFAULT '',
      label TEXT,
      accessToken TEXT,
      refreshToken TEXT,
      tokenExpiry INTEGER,
      imapHost TEXT,
      imapPort INTEGER,
      imapUsername TEXT,
      imapPasswordEncrypted TEXT,
      smtpHost TEXT,
      smtpPort INTEGER,
      smtpSecure INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS email_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      integrationId INTEGER,
      gmailMessageId TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      fromAddress TEXT NOT NULL DEFAULT '',
      fromName TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      fullBody TEXT,
      receivedAt INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      draftReply TEXT,
      taskId INTEGER,
      googleCalendarEventId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);

  // Migraciones para columnas añadidas en versiones posteriores
  const migrations = [
    "ALTER TABLE action_items ADD COLUMN metrica TEXT",
    "ALTER TABLE action_items ADD COLUMN valorObjetivo TEXT",
    "ALTER TABLE action_items ADD COLUMN googleCalendarEventId TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS diary_entries_user_date ON diary_entries(userId, date)",
    // Migraciones para multi-cuenta
    "ALTER TABLE user_integrations ADD COLUMN label TEXT",
    "ALTER TABLE user_integrations ADD COLUMN imapHost TEXT",
    "ALTER TABLE user_integrations ADD COLUMN imapPort INTEGER",
    "ALTER TABLE user_integrations ADD COLUMN imapUsername TEXT",
    "ALTER TABLE user_integrations ADD COLUMN imapPasswordEncrypted TEXT",
    "ALTER TABLE user_integrations ADD COLUMN smtpHost TEXT",
    "ALTER TABLE user_integrations ADD COLUMN smtpPort INTEGER",
    "ALTER TABLE user_integrations ADD COLUMN smtpSecure INTEGER DEFAULT 1",
    "ALTER TABLE email_signals ADD COLUMN integrationId INTEGER",
    "CREATE UNIQUE INDEX IF NOT EXISTS email_signals_user_gmail ON email_signals(userId, gmailMessageId)",
    "CREATE INDEX IF NOT EXISTS user_integrations_user_provider ON user_integrations(userId, provider)",
    "ALTER TABLE users ADD COLUMN emailFilterPrefs TEXT",
    "ALTER TABLE action_items ADD COLUMN tipo TEXT NOT NULL DEFAULT 'tarea'",
    "ALTER TABLE email_signals ADD COLUMN classifierUserFeedback TEXT",
    "ALTER TABLE users ADD COLUMN timezone TEXT",
    "ALTER TABLE user_integrations ADD COLUMN emailFilterPrefs TEXT",
    "ALTER TABLE users ADD COLUMN autoSyncEnabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE notes ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE action_items ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS pulse_day_cache (
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      contextHash TEXT NOT NULL,
      summary TEXT NOT NULL,
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (userId, date)
    )`,
    `CREATE TABLE IF NOT EXISTS bank_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      bookedDate TEXT NOT NULL,
      valueDate TEXT,
      description TEXT NOT NULL,
      extra TEXT,
      amount REAL NOT NULL,
      balance REAL,
      source TEXT NOT NULL DEFAULT 'caixa_xls',
      importedAt INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS bank_movements_user_booked ON bank_movements(userId, bookedDate)`,
    `CREATE TABLE IF NOT EXISTS bank_import_state (
      userId INTEGER PRIMARY KEY,
      accountHint TEXT,
      fileName TEXT,
      lastImportedAt INTEGER NOT NULL,
      movementCount INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS notification_settings (
      userId INTEGER PRIMARY KEY,
      telegramChatId TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      emailFrequency TEXT NOT NULL DEFAULT 'instant',
      taskFrequency TEXT NOT NULL DEFAULT 'instant',
      dailyDigestTime TEXT NOT NULL DEFAULT '09:00',
      lastDailyDigestDate TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS notification_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      refId INTEGER,
      dedupeKey TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sentAt INTEGER,
      lastError TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS notification_queue_user_status ON notification_queue(userId, status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_dedupe ON notification_queue(userId, dedupeKey) WHERE dedupeKey IS NOT NULL`,
    // Migración: el antiguo valor "instant" ya no es válido para tareas (el usuario
    // crea las tareas a mano, no necesita ping al crearlas). Se pasan a "daily".
    `UPDATE notification_settings SET taskFrequency = 'daily' WHERE taskFrequency = 'instant'`,
  ];
  for (const migration of migrations) {
    try { sqlite.exec(migration); } catch (_) { /* columna ya existe */ }
  }

  sqlite.close();
  console.log(`[Database] SQLite initialized at: ${DB_PATH}`);
}

// ─── Helpers de Usuario ───────────────────────────────────────────────────────
export async function createUser(data: {
  username: string;
  email?: string;
  passwordHash: string;
  name?: string;
  timezone?: string | null;
}): Promise<typeof users.$inferSelect> {
  const db = getDb();
  const result = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email ?? null,
      passwordHash: data.passwordHash,
      name: data.name ?? null,
      timezone: data.timezone?.trim() ? data.timezone.trim() : null,
    })
    .returning();
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateUserLastSignedIn(id: number) {
  const db = getDb();
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function updateUserOnboarding(
  userId: number,
  data: {
    onboardingCompleted?: boolean;
    guardianEnabled?: boolean;
    valuesFrameworkName?: string;
    name?: string;
    timezone?: string | null;
  }
) {
  const db = getDb();
  await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getAutoSyncUserIds(): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.autoSyncEnabled, true));
  return rows.map((r) => r.id);
}

export async function setUserAutoSync(userId: number, enabled: boolean) {
  const db = getDb();
  await db
    .update(users)
    .set({ autoSyncEnabled: enabled, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserTimezone(userId: number, timezone: string | null) {
  const db = getDb();
  await db
    .update(users)
    .set({ timezone: timezone?.trim() ? timezone.trim() : null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getEmailFilterPrefs(userId: number): Promise<string | null> {
  const db = getDb();
  const result = await db.select({ emailFilterPrefs: users.emailFilterPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.emailFilterPrefs ?? null;
}

export async function setEmailFilterPrefs(userId: number, prefs: string) {
  const db = getDb();
  await db.update(users).set({ emailFilterPrefs: prefs, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ─── Helpers de La Bóveda ─────────────────────────────────────────────────────
export async function getVaultByUserId(userId: number) {
  const db = getDb();
  const result = await db.select().from(vault).where(eq(vault.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertVault(userId: number, data: Partial<InsertVault>) {
  const db = getDb();
  const existing = await getVaultByUserId(userId);
  if (existing) {
    await db
      .update(vault)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vault.userId, userId));
  } else {
    await db.insert(vault).values({ userId, ...data });
  }
}

// ─── Helpers de Conversaciones ────────────────────────────────────────────────
export async function getConversationsByUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getOrCreateConversation(
  userId: number,
  agentId: string
): Promise<typeof conversations.$inferSelect> {
  const db = getDb();
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.agentId, agentId as any)))
    .limit(1);

  if (existing[0]) return existing[0];

  const result = await db
    .insert(conversations)
    .values({ userId, agentId: agentId as any })
    .returning();
  return result[0];
}

export async function incrementMessageCount(conversationId: number, currentCount?: number) {
  const db = getDb();
  if (currentCount !== undefined) {
    await db
      .update(conversations)
      .set({ messageCount: currentCount + 1, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  } else {
    // Incrementar usando SQL directo
    const conv = await db.select({ count: conversations.messageCount }).from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    const count = conv[0]?.count ?? 0;
    await db
      .update(conversations)
      .set({ messageCount: count + 1, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
}

export async function updateConversationSummary(
  conversationId: number,
  summary: string,
  messageCount: number
) {
  const db = getDb();
  await db
    .update(conversations)
    .set({ summary, lastSummaryAt: messageCount, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

// ─── Helpers de Mensajes ──────────────────────────────────────────────────────
export async function getMessagesByConversation(conversationId: number, limit?: number) {
  const db = getDb();
  if (limit !== undefined) {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse();
  }
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function insertMessage(data: InsertMessage) {
  const db = getDb();
  const result = await db.insert(messages).values(data).returning();
  return result[0];
}

// ─── Helpers del Plan de Acción ───────────────────────────────────────────────
export async function getActionItemsByUser(userId: number, agentId?: string) {
  const db = getDb();
  if (agentId) {
    return db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.userId, userId), eq(actionItems.agentId, agentId as any)))
      .orderBy(desc(actionItems.createdAt));
  }
  return db
    .select()
    .from(actionItems)
    .where(eq(actionItems.userId, userId))
    .orderBy(desc(actionItems.createdAt));
}

export async function insertActionItem(data: InsertActionItem) {
  const db = getDb();
  const result = await db.insert(actionItems).values(data).returning();
  return result[0];
}

export async function updateActionItemTipo(id: number, userId: number, tipo: "tarea" | "habito") {
  const db = getDb();
  await db.update(actionItems).set({ tipo, updatedAt: new Date() })
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));
}

export async function updateActionItemStatus(
  id: number,
  userId: number,
  status: "pendiente" | "en_progreso" | "completada" | "cancelada"
) {
  const db = getDb();
  await db
    .update(actionItems)
    .set({
      status,
      completedAt: status === "completada" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));
}

export async function updateActionItemArchived(id: number, userId: number, isArchived: boolean) {
  const db = getDb();
  await db
    .update(actionItems)
    .set({ isArchived, updatedAt: new Date() })
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));
}

export async function deleteActionItem(id: number, userId: number) {
  const db = getDb();
  await db
    .delete(actionItems)
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));
}

// ─── Helpers de Memoria ───────────────────────────────────────────────────────
export async function getMemoryByAgent(userId: number, agentId: string, limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.userId, userId), eq(memoryEntries.agentId, agentId as any)))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(limit);
}

/** Recupera las memorias más importantes/recientes de todos los demás asesores (para memoria cruzada del Guardián). */
export async function getCrossAgentMemories(userId: number, excludeAgentId: string, limit = 12) {
  const db = getDb();
  const rows = await db
    .select()
    .from(memoryEntries)
    .where(eq(memoryEntries.userId, userId))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(100);
  return rows
    .filter((r) => r.agentId !== excludeAgentId)
    .sort((a, b) => {
      const w = { alta: 3, media: 2, baja: 1 } as const;
      const diff = (w[b.importance] ?? 0) - (w[a.importance] ?? 0);
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limit);
}

export async function insertMemoryEntry(data: InsertMemoryEntry) {
  const db = getDb();
  await db.insert(memoryEntries).values(data);
}

// ─── Helpers de Diario ────────────────────────────────────────────────────────
export async function getDiaryEntry(userId: number, date: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertDiaryEntry(
  userId: number,
  date: string,
  data: { content?: string; mood?: "bien" | "regular" | "mal" | null; locationData?: unknown }
) {
  const db = getDb();
  const existing = await getDiaryEntry(userId, date);
  const now = new Date();
  if (existing) {
    await db
      .update(diaryEntries)
      .set({ ...data, updatedAt: now })
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)));
    return getDiaryEntry(userId, date);
  } else {
    const result = await db
      .insert(diaryEntries)
      .values({ userId, date, content: data.content ?? "", mood: data.mood ?? null, locationData: data.locationData ?? null })
      .returning();
    return result[0];
  }
}

export async function getRecentDiaryEntries(userId: number, limit = 30) {
  const db = getDb();
  return db
    .select()
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, userId))
    .orderBy(desc(diaryEntries.date))
    .limit(limit);
}

export async function searchDiaryEntries(userId: number, query: string, limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), like(diaryEntries.content, `%${query}%`)))
    .orderBy(desc(diaryEntries.date))
    .limit(limit);
}

export async function getDiaryEntriesByMonth(userId: number, yearMonth: string) {
  const db = getDb();
  return db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), like(diaryEntries.date, `${yearMonth}%`)))
    .orderBy(desc(diaryEntries.date));
}

// ─── Helpers de Notas ─────────────────────────────────────────────────────────
export async function getNotesByUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt));
}

export async function getNoteById(userId: number, id: number) {
  const db = getDb();
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function insertNote(userId: number, data: Omit<InsertNote, "userId" | "id" | "createdAt" | "updatedAt">) {
  const db = getDb();
  const result = await db
    .insert(notes)
    .values({ userId, ...data })
    .returning();
  return result[0];
}

export async function updateNote(
  userId: number,
  id: number,
  data: Partial<Pick<InsertNote, "title" | "content" | "tag" | "isPinned" | "isArchived">>
) {
  const db = getDb();
  await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return getNoteById(userId, id);
}

export async function deleteNote(userId: number, id: number) {
  const db = getDb();
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function getPulseDayCache(userId: number, date: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(pulseDayCache)
    .where(and(eq(pulseDayCache.userId, userId), eq(pulseDayCache.date, date)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertPulseDayCache(
  userId: number,
  date: string,
  contextHash: string,
  summary: string
) {
  const db = getDb();
  const now = new Date();
  await db
    .insert(pulseDayCache)
    .values({
      userId,
      date,
      contextHash,
      summary,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pulseDayCache.userId, pulseDayCache.date],
      set: {
        contextHash,
        summary,
        updatedAt: now,
      },
    });
}

export async function searchNotes(userId: number, query: string) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        or(like(notes.title, q), like(notes.content, q))
      )
    )
    .orderBy(desc(notes.updatedAt));
}

// ─── Importación bancaria (CaixaBank .xls, etc.) ─────────────────────────────
export async function getBankImportState(userId: number) {
  const db = getDb();
  const rows = await db.select().from(bankImportState).where(eq(bankImportState.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function replaceBankMovementsForUser(
  userId: number,
  meta: {
    accountHint: string | null;
    fileName: string | null;
    movements: Array<{
      bookedDate: string;
      valueDate: string;
      description: string;
      extra: string;
      amount: number;
      balance: number | null;
      source: string;
    }>;
  }
) {
  const db = getDb();
  const now = new Date();
  await db.delete(bankMovements).where(eq(bankMovements.userId, userId));

  const rows = meta.movements.map((m) => ({
    userId,
    bookedDate: m.bookedDate,
    valueDate: m.valueDate,
    description: m.description,
    extra: m.extra.length ? m.extra : null,
    amount: m.amount,
    balance: m.balance,
    source: m.source,
    importedAt: now,
  }));

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(bankMovements).values(rows.slice(i, i + CHUNK));
  }

  await db
    .insert(bankImportState)
    .values({
      userId,
      accountHint: meta.accountHint,
      fileName: meta.fileName,
      lastImportedAt: now,
      movementCount: rows.length,
    })
    .onConflictDoUpdate({
      target: bankImportState.userId,
      set: {
        accountHint: meta.accountHint,
        fileName: meta.fileName,
        lastImportedAt: now,
        movementCount: rows.length,
      },
    });
}

export async function getBankMovementsForUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(bankMovements)
    .where(eq(bankMovements.userId, userId))
    .orderBy(asc(bankMovements.bookedDate), asc(bankMovements.id));
}

export async function clearBankImportForUser(userId: number) {
  const db = getDb();
  await db.delete(bankMovements).where(eq(bankMovements.userId, userId));
  await db.delete(bankImportState).where(eq(bankImportState.userId, userId));
}

// ─── Export / Import completo ────────────────────────────────────────────────
export async function exportUserData(userId: number) {
  const db = getDb();
  const [vaultRow, noteRows, actionRows, diaryRows, memoryRows, bankRows, bankState] = await Promise.all([
    db.select().from(vault).where(eq(vault.userId, userId)).limit(1),
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(actionItems).where(eq(actionItems.userId, userId)),
    db.select().from(diaryEntries).where(eq(diaryEntries.userId, userId)),
    db.select().from(memoryEntries).where(eq(memoryEntries.userId, userId)),
    db.select().from(bankMovements).where(eq(bankMovements.userId, userId)),
    db.select().from(bankImportState).where(eq(bankImportState.userId, userId)).limit(1),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    vault: vaultRow[0] ?? null,
    notes: noteRows,
    actionItems: actionRows,
    diaryEntries: diaryRows,
    memoryEntries: memoryRows,
    bankMovements: bankRows,
    bankImportState: bankState[0] ?? null,
  };
}

export async function replaceUserData(
  userId: number,
  data: {
    vault?: any;
    notes?: any[];
    actionItems?: any[];
    diaryEntries?: any[];
    memoryEntries?: any[];
    bankMovements?: any[];
    bankImportState?: any | null;
  }
) {
  const db = getDb();
  // Borrado previo del usuario en tablas soportadas
  await Promise.all([
    db.delete(notes).where(eq(notes.userId, userId)),
    db.delete(actionItems).where(eq(actionItems.userId, userId)),
    db.delete(diaryEntries).where(eq(diaryEntries.userId, userId)),
    db.delete(memoryEntries).where(eq(memoryEntries.userId, userId)),
    db.delete(bankMovements).where(eq(bankMovements.userId, userId)),
    db.delete(bankImportState).where(eq(bankImportState.userId, userId)),
  ]);

  const strip = <T extends Record<string, any>>(row: T) => {
    const { id: _id, userId: _u, ...rest } = row as any;
    return { ...rest, userId };
  };

  if (data.vault) {
    await upsertVault(userId, {
      financialStatus: data.vault.financialStatus ?? null,
      careerData: data.vault.careerData ?? null,
      healthMetrics: data.vault.healthMetrics ?? null,
      relationshipStatus: data.vault.relationshipStatus ?? null,
      familyCircle: data.vault.familyCircle ?? null,
      valuesFramework: data.vault.valuesFramework ?? null,
      personalInfo: data.vault.personalInfo ?? null,
    });
  }
  if (Array.isArray(data.notes) && data.notes.length) {
    await db.insert(notes).values(
      data.notes.map((r) => {
        const s = strip(r) as any;
        if (s.isArchived === undefined) s.isArchived = false;
        return s;
      })
    );
  }
  if (Array.isArray(data.actionItems) && data.actionItems.length) {
    await db.insert(actionItems).values(
      data.actionItems.map((r) => {
        const s = strip(r) as any;
        if (s.deadline && typeof s.deadline === "string") s.deadline = new Date(s.deadline);
        if (s.completedAt && typeof s.completedAt === "string") s.completedAt = new Date(s.completedAt);
        if (s.isArchived === undefined) s.isArchived = false;
        return s;
      })
    );
  }
  if (Array.isArray(data.diaryEntries) && data.diaryEntries.length) {
    await db.insert(diaryEntries).values(data.diaryEntries.map(strip));
  }
  if (Array.isArray(data.memoryEntries) && data.memoryEntries.length) {
    await db.insert(memoryEntries).values(data.memoryEntries.map(strip));
  }
  if (Array.isArray(data.bankMovements) && data.bankMovements.length) {
    await db.insert(bankMovements).values(
      data.bankMovements.map((r) => {
        const s = strip(r) as any;
        if (s.importedAt && typeof s.importedAt === "string") s.importedAt = new Date(s.importedAt);
        return s;
      })
    );
  }
  if (data.bankImportState && typeof data.bankImportState === "object") {
    const s = strip(data.bankImportState) as any;
    if (s.lastImportedAt && typeof s.lastImportedAt === "string") s.lastImportedAt = new Date(s.lastImportedAt);
    await db.insert(bankImportState).values(s);
  }
}

export async function searchActionItems(userId: number, query: string, limit = 20) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(actionItems)
    .where(
      and(
        eq(actionItems.userId, userId),
        or(like(actionItems.title, q), like(actionItems.description, q))
      )
    )
    .orderBy(desc(actionItems.updatedAt))
    .limit(limit);
}

export async function searchEmailSignals(userId: number, query: string, limit = 20) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(emailSignals)
    .where(
      and(
        eq(emailSignals.userId, userId),
        or(
          like(emailSignals.subject, q),
          like(emailSignals.fromName, q),
          like(emailSignals.fromAddress, q),
          like(emailSignals.snippet, q)
        )
      )
    )
    .orderBy(desc(emailSignals.receivedAt))
    .limit(limit);
}

export async function searchConversations(userId: number, query: string, limit = 20) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        or(like(conversations.title, q), like(conversations.summary, q))
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

// ─── Helpers de Integraciones (multi-cuenta) ──────────────────────────────────
export type ProviderName = "google" | "microsoft" | "imap";

export async function getIntegrationsByUser(userId: number) {
  const db = getDb();
  return db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId))
    .orderBy(userIntegrations.createdAt);
}

export async function getIntegrationById(userId: number, id: number) {
  const db = getDb();
  const result = await db
    .select()
    .from(userIntegrations)
    .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function getIntegrationByEmail(userId: number, provider: ProviderName, email: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.provider, provider),
        eq(userIntegrations.connectedEmail, email)
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function upsertOAuthIntegration(
  userId: number,
  provider: "google" | "microsoft",
  connectedEmail: string,
  data: { accessToken?: string; refreshToken?: string; tokenExpiry?: Date; label?: string }
) {
  const db = getDb();
  const existing = await getIntegrationByEmail(userId, provider, connectedEmail);
  const now = new Date();
  if (existing) {
    await db
      .update(userIntegrations)
      .set({ ...data, updatedAt: now })
      .where(eq(userIntegrations.id, existing.id));
    return existing.id;
  } else {
    const result = await db
      .insert(userIntegrations)
      .values({
        userId,
        provider,
        connectedEmail,
        refreshToken: data.refreshToken ?? null,
        accessToken: data.accessToken ?? null,
        tokenExpiry: data.tokenExpiry ?? null,
        label: data.label ?? null,
      })
      .returning();
    return result[0].id;
  }
}

export async function insertImapIntegration(
  userId: number,
  data: {
    connectedEmail: string;
    label?: string;
    imapHost: string;
    imapPort: number;
    imapUsername: string;
    imapPasswordEncrypted: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
  }
) {
  const db = getDb();
  const result = await db
    .insert(userIntegrations)
    .values({ userId, provider: "imap", ...data })
    .returning();
  return result[0];
}

export async function updateIntegrationTokens(
  id: number,
  data: { accessToken?: string; refreshToken?: string; tokenExpiry?: Date }
) {
  const db = getDb();
  await db
    .update(userIntegrations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userIntegrations.id, id));
}

export async function setIntegrationFilterPrefs(userId: number, id: number, prefs: string) {
  const db = getDb();
  await db
    .update(userIntegrations)
    .set({ emailFilterPrefs: prefs, updatedAt: new Date() })
    .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)));
}

export async function deleteIntegrationById(userId: number, id: number) {
  const db = getDb();
  await db
    .delete(userIntegrations)
    .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)));
}

// Helper legacy — mantiene compat con código previo si quedara algo
export async function getIntegrationByUser(userId: number, provider: ProviderName) {
  const db = getDb();
  const result = await db
    .select()
    .from(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, provider)))
    .limit(1);
  return result[0] ?? null;
}

// ─── Helpers de Señales de Email ──────────────────────────────────────────────
export async function insertEmailSignal(data: InsertEmailSignal) {
  const db = getDb();
  try {
    const result = await db.insert(emailSignals).values(data).returning();
    return result[0];
  } catch {
    // Duplicado silencioso (ya existe este gmailMessageId para este usuario)
    return null;
  }
}

export async function getEmailSignalsByUser(userId: number, status?: string) {
  const db = getDb();
  if (status) {
    return db
      .select()
      .from(emailSignals)
      .where(and(eq(emailSignals.userId, userId), eq(emailSignals.status, status as any)))
      .orderBy(desc(emailSignals.receivedAt));
  }
  return db
    .select()
    .from(emailSignals)
    .where(eq(emailSignals.userId, userId))
    .orderBy(desc(emailSignals.receivedAt));
}

export async function getEmailSignalById(userId: number, id: number) {
  const db = getDb();
  const result = await db
    .select()
    .from(emailSignals)
    .where(and(eq(emailSignals.id, id), eq(emailSignals.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function updateEmailSignalStatus(
  userId: number,
  id: number,
  status: "pending" | "low_priority" | "replied" | "ignored" | "converted" | "archived",
  extra?: { draftReply?: string; taskId?: number; googleCalendarEventId?: string }
) {
  const db = getDb();
  await db
    .update(emailSignals)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(and(eq(emailSignals.id, id), eq(emailSignals.userId, userId)));
}

export async function getPendingSignalCount(userId: number): Promise<number> {
  const db = getDb();
  const result = await db
    .select()
    .from(emailSignals)
    .where(and(eq(emailSignals.userId, userId), eq(emailSignals.status, "pending")));
  return result.length;
}

export async function setEmailSignalClassifierFeedback(
  userId: number,
  signalId: number,
  feedback: "spot_on" | "not_important"
) {
  const db = getDb();
  const row = await getEmailSignalById(userId, signalId);
  if (!row) return;
  await db
    .update(emailSignals)
    .set({
      classifierUserFeedback: feedback,
      updatedAt: new Date(),
      ...(feedback === "not_important"
        ? { status: "ignored" as const }
        : row.status === "low_priority"
          ? { status: "pending" as const }
          : {}),
    })
    .where(and(eq(emailSignals.id, signalId), eq(emailSignals.userId, userId)));
}

/** Pasa un correo del registro secundario (IA no lo destacó) a pendientes / importantes. */
export async function promoteEmailSignalFromRegistry(userId: number, id: number): Promise<boolean> {
  const row = await getEmailSignalById(userId, id);
  if (!row || row.status !== "low_priority") return false;
  const db = getDb();
  await db
    .update(emailSignals)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(emailSignals.id, id), eq(emailSignals.userId, userId)));
  return true;
}

/** Ejemplos recientes de aciertos/errores del filtro para enriquecer el prompt del clasificador */
export async function getRecentClassifierFeedbackExamples(userId: number, limit = 15) {
  const db = getDb();
  return db
    .select({
      subject: emailSignals.subject,
      fromAddress: emailSignals.fromAddress,
      snippet: emailSignals.snippet,
      classifierUserFeedback: emailSignals.classifierUserFeedback,
    })
    .from(emailSignals)
    .where(and(eq(emailSignals.userId, userId), isNotNull(emailSignals.classifierUserFeedback)))
    .orderBy(desc(emailSignals.updatedAt))
    .limit(limit);
}

// ─── Helpers de Notificaciones ────────────────────────────────────────────────
export const DEFAULT_NOTIFICATION_SETTINGS = {
  telegramChatId: null as string | null,
  enabled: true,
  emailFrequency: "instant" as const,
  taskFrequency: "daily" as const,
  dailyDigestTime: "09:00",
  lastDailyDigestDate: null as string | null,
};

export async function getNotificationSettings(userId: number): Promise<NotificationSettings | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertNotificationSettings(
  userId: number,
  data: Partial<Omit<InsertNotificationSettings, "userId" | "createdAt" | "updatedAt">>
) {
  const db = getDb();
  const existing = await getNotificationSettings(userId);
  if (existing) {
    await db
      .update(notificationSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values({ userId, ...data });
  }
  return (await getNotificationSettings(userId))!;
}

export async function listNotificationSettings(): Promise<NotificationSettings[]> {
  const db = getDb();
  return db.select().from(notificationSettings);
}

export async function enqueueNotification(
  data: Omit<InsertNotificationQueueRow, "status" | "createdAt">
): Promise<NotificationQueueRow | null> {
  const db = getDb();
  try {
    const result = await db
      .insert(notificationQueue)
      .values({ ...data, status: "pending" })
      .returning();
    return result[0] ?? null;
  } catch {
    // UNIQUE violation por dedupeKey → ya encolado
    return null;
  }
}

export async function getPendingNotifications(userId: number, kinds?: Array<NotificationQueueRow["kind"]>) {
  const db = getDb();
  const rows = await db
    .select()
    .from(notificationQueue)
    .where(and(eq(notificationQueue.userId, userId), eq(notificationQueue.status, "pending")))
    .orderBy(asc(notificationQueue.createdAt));
  if (!kinds?.length) return rows;
  return rows.filter((r) => kinds.includes(r.kind));
}

export async function markNotificationsSent(ids: number[]) {
  if (!ids.length) return;
  const db = getDb();
  for (const id of ids) {
    await db
      .update(notificationQueue)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(notificationQueue.id, id));
  }
}

export async function markNotificationFailed(id: number, error: string) {
  const db = getDb();
  await db
    .update(notificationQueue)
    .set({ status: "failed", lastError: error.slice(0, 500) })
    .where(eq(notificationQueue.id, id));
}

// Legacy compatibility exports (used in routers.ts)
export async function upsertUser(data: any) {
  // Not used in local version — kept for compatibility
}

export async function getUserByOpenId(openId: string) {
  // Not used in local version — kept for compatibility
  return null;
}
