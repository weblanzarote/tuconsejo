import { ENV } from "../_core/env";

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

/**
 * Envía un mensaje a un chat de Telegram a través del bot configurado.
 * Devuelve `ok: true` si Telegram aceptó el mensaje; en caso contrario incluye `error`.
 *
 * Configuración:
 *  - `TELEGRAM_BOT_TOKEN` en .env (el bot se crea con @BotFather)
 *  - `chatId` se obtiene por usuario (el usuario habla al bot y coge el chat_id desde
 *    https://api.telegram.org/bot<TOKEN>/getUpdates, o lo guardamos tras /start)
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  const token = ENV.telegramBotToken;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN no configurado en .env" };
  }
  if (!chatId.trim()) {
    return { ok: false, error: "chatId vacío" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: text.slice(0, 4000), // Telegram limita a ~4096 chars
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!data?.ok) {
      return { ok: false, error: data?.description ?? "Respuesta inválida de Telegram" };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/** Escapa texto para no romper HTML de Telegram (parse_mode=HTML) */
export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
