import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "consejo.db");
const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backups");
const DAILY_KEEP = 7;
const WEEKLY_KEEP = 4;
const INITIAL_DELAY_MS = 2 * 60_000;
const INTERVAL_MS = 24 * 3600 * 1000;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function yyyymmdd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function listBackups(prefix: string): string[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".db"))
    .sort();
}

function rotate(prefix: string, keep: number) {
  const files = listBackups(prefix);
  const excess = files.length - keep;
  for (let i = 0; i < excess; i++) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
    } catch {}
  }
}

function runBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn("[Backup] DB no encontrada, se omite");
      return;
    }
    ensureDir(BACKUP_DIR);

    const now = new Date();
    const dailyPath = path.join(BACKUP_DIR, `daily-${yyyymmdd(now)}.db`);
    if (fs.existsSync(dailyPath)) return;

    const src = new Database(DB_PATH, { readonly: true });
    try {
      src.exec(`VACUUM INTO '${dailyPath.replace(/'/g, "''")}'`);
    } finally {
      src.close();
    }

    // Copia semanal los domingos (día 0)
    if (now.getDay() === 0) {
      const year = now.getFullYear();
      const onejan = new Date(year, 0, 1);
      const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
      const weeklyPath = path.join(BACKUP_DIR, `weekly-${year}-W${String(week).padStart(2, "0")}.db`);
      if (!fs.existsSync(weeklyPath)) {
        try {
          fs.copyFileSync(dailyPath, weeklyPath);
        } catch (err: any) {
          console.warn("[Backup] copia semanal falló:", err?.message ?? err);
        }
      }
    }

    rotate("daily-", DAILY_KEEP);
    rotate("weekly-", WEEKLY_KEEP);

    const stats = fs.statSync(dailyPath);
    const mb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`[Backup] ${path.basename(dailyPath)} (${mb} MB)`);
  } catch (err: any) {
    console.error("[Backup] Error:", err?.message ?? err);
  }
}

export function startBackupScheduler() {
  console.log(`[Backup] Programado cada 24h en ${BACKUP_DIR}`);
  setTimeout(() => {
    runBackup();
    setInterval(runBackup, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

export function checkIntegrity(): { ok: boolean; result: string } {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined;
      const result = row?.integrity_check ?? "unknown";
      return { ok: result === "ok", result };
    } finally {
      db.close();
    }
  } catch (err: any) {
    return { ok: false, result: err?.message ?? String(err) };
  }
}
