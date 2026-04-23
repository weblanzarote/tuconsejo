/**
 * Proveedor de correo Google (Gmail API).
 */
import type { UserIntegration } from "../../drizzle/schema";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  assertGoogleOAuthClientConfigured,
  describeGoogleTokenEndpointError,
} from "../googleOAuthEnv";
import { updateIntegrationTokens } from "../db";
import type { MailProvider, MessageDetail, MessageMeta } from "./types";
import { parseFrom } from "./types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function refreshGoogleToken(integration: UserIntegration): Promise<string> {
  if (!integration.refreshToken) throw new Error("GOOGLE_NO_REFRESH_TOKEN");
  assertGoogleOAuthClientConfigured();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: integration.refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }).toString(),
  });
  const errText = await res.text();
  if (!res.ok) {
    throw new Error(`[Google] ${describeGoogleTokenEndpointError(errText)}`);
  }
  const data = JSON.parse(errText) as { access_token: string; expires_in: number };
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);
  await updateIntegrationTokens(integration.id, {
    accessToken: data.access_token,
    tokenExpiry: newExpiry,
  });
  return data.access_token;
}

async function getAccessToken(integration: UserIntegration): Promise<string> {
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;
  const expiry = integration.tokenExpiry ? integration.tokenExpiry.getTime() : 0;
  if (integration.accessToken && expiry > now + fiveMin) {
    return integration.accessToken;
  }
  return refreshGoogleToken(integration);
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
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      const nested = extractTextParts(part);
      if (nested) return nested;
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      }
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

export const googleProvider: MailProvider = {
  async fetchRecent(integration, maxResults = 30) {
    const token = await getAccessToken(integration);
    const listWithQuery = async (q: string): Promise<MessageMeta[]> => {
      const params = new URLSearchParams({ maxResults: String(maxResults), q });
      const res = await fetch(`${GMAIL_BASE}/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`[Gmail] fetchRecent: ${res.status}`);
      const data = await res.json();
      const messages: Array<{ id: string; threadId: string }> = (data as any).messages ?? [];
      return messages.map((m) => ({ providerMessageId: m.id, threadId: m.threadId })) as MessageMeta[];
    };
    /** Inbox completa (incl. pestañas Promociones/Social: el filtro antiguo dejaba fuera mucho correo personal). */
    let out = await listWithQuery("in:inbox");
    /** Si la bandeja está vacía por filtros (“saltar bandeja”), traer recientes de los últimos 14 días. */
    if (out.length === 0) {
      out = await listWithQuery("newer_than:14d -in:spam -in:trash -in:drafts");
    }
    return out.slice(0, maxResults);
  },

  async fetchDetail(integration, messageId) {
    const token = await getAccessToken(integration);
    const res = await fetch(`${GMAIL_BASE}/messages/${messageId}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const msg = await res.json();
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const subject = getHeader("subject") || "(sin asunto)";
    const fromRaw = getHeader("from");
    const dateStr = getHeader("date");
    const toRaw = getHeader("to");
    const ccRaw = getHeader("cc");
    const toCcSummary = [toRaw && `Para: ${toRaw}`, ccRaw && `Cc: ${ccRaw}`].filter(Boolean).join(" | ").slice(0, 600);
    const { name: fromName, address: fromAddress } = parseFrom(fromRaw);
    return {
      providerMessageId: messageId,
      threadId: msg.threadId ?? messageId,
      subject,
      fromName,
      fromAddress,
      toCcSummary: toCcSummary || undefined,
      snippet: msg.snippet ?? "",
      fullBody: extractTextParts(msg.payload).slice(0, 5000),
      receivedAt: dateStr ? new Date(dateStr) : new Date(),
      inReplyToHeader: getHeader("message-id"),
    };
  },

  async send(integration, to, subject, body, inReplyTo) {
    const token = await getAccessToken(integration);
    const headers = [
      `To: ${to}`,
      `From: ${integration.connectedEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      `MIME-Version: 1.0`,
    ];
    if (inReplyTo) {
      headers.push(`In-Reply-To: <${inReplyTo}>`);
      headers.push(`References: <${inReplyTo}>`);
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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) throw new Error(`[Gmail] send: ${await res.text()}`);
    const data = await res.json();
    return { id: data.id };
  },
};

export interface CalendarEventItem {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  htmlLink?: string;
}

// Lista eventos próximos en el calendario primario
export async function listGoogleUpcomingEvents(
  integration: UserIntegration,
  fromIso: string,
  toIso: string,
  maxResults = 20
): Promise<CalendarEventItem[]> {
  const token = await getAccessToken(integration);
  const params = new URLSearchParams({
    timeMin: fromIso,
    timeMax: toIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`[Calendar] list: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.items ?? [];
  return items.map((ev) => {
    const allDay = !!ev.start?.date;
    const startStr: string = ev.start?.dateTime ?? ev.start?.date ?? "";
    const endStr: string = ev.end?.dateTime ?? ev.end?.date ?? startStr;
    return {
      id: ev.id,
      title: ev.summary ?? "(sin título)",
      start: startStr,
      end: endStr,
      allDay,
      location: ev.location ?? undefined,
      htmlLink: ev.htmlLink ?? undefined,
    };
  });
}

// Crear evento de Google Calendar (solo Google)
export async function createGoogleCalendarEvent(
  integration: UserIntegration,
  event: { title: string; startDatetime: string; endDatetime: string; description?: string }
): Promise<{ id: string; htmlLink: string }> {
  const token = await getAccessToken(integration);
  const body = {
    summary: event.title,
    description: event.description ?? "",
    start: { dateTime: event.startDatetime, timeZone: "Europe/Madrid" },
    end: { dateTime: event.endDatetime, timeZone: "Europe/Madrid" },
  };
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`[Calendar] createEvent: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}
