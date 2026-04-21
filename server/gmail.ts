/**
 * Helpers para la API REST de Gmail y Google Calendar.
 * Todas las funciones reciben el accessToken como primer argumento.
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

// ─── Gmail: listar mensajes ───────────────────────────────────────────────────
export async function fetchRecentMessages(
  accessToken: string,
  maxResults = 30
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "in:inbox -category:promotions -category:social",
  });
  const res = await fetch(`${GMAIL_BASE}/messages?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`[Gmail] fetchRecentMessages: ${res.status}`);
  const data = await res.json();
  return (data as any).messages ?? [];
}

// ─── Gmail: detalle de un mensaje ────────────────────────────────────────────
export interface GmailMessageDetail {
  gmailMessageId: string;
  subject: string;
  fromRaw: string;
  fromName: string;
  fromAddress: string;
  snippet: string;
  fullBody: string;
  receivedAt: Date;
  threadId: string;
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractTextParts(payload: any): string {
  if (!payload) return "";

  // Si tiene partes, buscar text/plain recursivamente
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Recursivo para multipart
      const nested = extractTextParts(part);
      if (nested) return nested;
    }
    // Si no hay text/plain, intentar text/html sin tags
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      }
    }
  }

  // Mensaje simple sin partes
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

export function parseFrom(fromRaw: string): { name: string; address: string } {
  const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, "").trim(),
      address: match[2].trim(),
    };
  }
  return { name: fromRaw, address: fromRaw };
}

export async function fetchMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail | null> {
  const res = await fetch(`${GMAIL_BASE}/messages/${messageId}?format=full`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) return null;
  const msg = await res.json();

  const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const subject = getHeader("subject") || "(sin asunto)";
  const fromRaw = getHeader("from");
  const dateStr = getHeader("date");
  const { name: fromName, address: fromAddress } = parseFrom(fromRaw);
  const snippet = msg.snippet ?? "";
  const fullBody = extractTextParts(msg.payload).slice(0, 5000);
  const receivedAt = dateStr ? new Date(dateStr) : new Date();

  return {
    gmailMessageId: messageId,
    subject,
    fromRaw,
    fromName,
    fromAddress,
    snippet,
    fullBody,
    receivedAt,
    threadId: msg.threadId ?? messageId,
  };
}

// ─── Gmail: enviar mensaje ────────────────────────────────────────────────────
export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  inReplyToMessageId?: string
): Promise<{ id: string }> {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
  ];
  if (inReplyToMessageId) {
    headers.push(`In-Reply-To: <${inReplyToMessageId}>`);
    headers.push(`References: <${inReplyToMessageId}>`);
  }
  const rawMessage = `${headers.join("\r\n")}\r\n\r\n${body}`;
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Gmail] sendMessage failed: ${err}`);
  }
  return res.json();
}

// ─── Google Calendar: crear evento ───────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  htmlLink: string;
}

export async function createCalendarEvent(
  accessToken: string,
  event: {
    title: string;
    startDatetime: string;
    endDatetime: string;
    description?: string;
  }
): Promise<CalendarEvent> {
  const body = {
    summary: event.title,
    description: event.description ?? "",
    start: { dateTime: event.startDatetime, timeZone: "Europe/Madrid" },
    end: { dateTime: event.endDatetime, timeZone: "Europe/Madrid" },
  };

  const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Calendar] createEvent failed: ${err}`);
  }
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}
