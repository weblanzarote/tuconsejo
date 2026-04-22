/**
 * Proveedor de correo Microsoft (Outlook / Microsoft 365) vía Microsoft Graph API.
 */
import type { UserIntegration } from "../../drizzle/schema";
import { updateIntegrationTokens } from "../db";
import type { MailProvider, MessageDetail, MessageMeta } from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";
const MS_TENANT = process.env.MICROSOFT_TENANT ?? "common"; // "common" acepta personales + corp

async function refreshMicrosoftToken(integration: UserIntegration): Promise<string> {
  if (!integration.refreshToken) throw new Error("MICROSOFT_NO_REFRESH_TOKEN");

  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken,
      scope: "offline_access Mail.ReadWrite Mail.Send User.Read",
    }).toString(),
  });
  if (!res.ok) throw new Error(`[Microsoft] refreshToken: ${await res.text()}`);
  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);
  await updateIntegrationTokens(integration.id, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? integration.refreshToken,
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
  return refreshMicrosoftToken(integration);
}

export const microsoftProvider: MailProvider = {
  async fetchRecent(integration, maxResults = 30) {
    const token = await getAccessToken(integration);
    const res = await fetch(
      `${GRAPH_BASE}/mailFolders/inbox/messages?$top=${maxResults}&$select=id,conversationId&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`[MS Graph] fetchRecent: ${res.status}`);
    const data = await res.json();
    const messages: Array<{ id: string; conversationId: string }> = (data as any).value ?? [];
    return messages.map((m) => ({ providerMessageId: m.id, threadId: m.conversationId }));
  },

  async fetchDetail(integration, messageId) {
    const token = await getAccessToken(integration);
    const res = await fetch(
      `${GRAPH_BASE}/messages/${messageId}?$select=id,conversationId,subject,from,toRecipients,ccRecipients,bodyPreview,body,receivedDateTime,internetMessageId`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const msg = await res.json();

    const joinRecip = (arr: Array<{ emailAddress?: { address?: string } }> | undefined) =>
      (arr ?? []).map((r) => r.emailAddress?.address).filter(Boolean).join(", ");

    const subject = msg.subject || "(sin asunto)";
    const fromName = msg.from?.emailAddress?.name ?? "";
    const fromAddress = msg.from?.emailAddress?.address ?? "";
    const toPart = joinRecip(msg.toRecipients);
    const ccPart = joinRecip(msg.ccRecipients);
    const toCcSummary = [toPart && `Para: ${toPart}`, ccPart && `Cc: ${ccPart}`].filter(Boolean).join(" | ").slice(0, 600);
    const snippet = msg.bodyPreview ?? "";

    let fullBody = "";
    if (msg.body?.contentType === "html") {
      fullBody = (msg.body.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } else {
      fullBody = msg.body?.content ?? "";
    }

    return {
      providerMessageId: msg.id,
      threadId: msg.conversationId ?? msg.id,
      subject,
      fromName,
      fromAddress,
      toCcSummary: toCcSummary || undefined,
      snippet,
      fullBody: fullBody.slice(0, 5000),
      receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
      inReplyToHeader: msg.internetMessageId,
    };
  },

  async send(integration, to, subject, body, _inReplyTo) {
    const token = await getAccessToken(integration);
    const payload = {
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    };
    const res = await fetch(`${GRAPH_BASE}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`[MS Graph] send: ${await res.text()}`);
    return { id: "sent" };
  },
};

import type { CalendarEventItem } from "./google";

// Lista eventos próximos de Outlook Calendar
export async function listMicrosoftUpcomingEvents(
  integration: UserIntegration,
  fromIso: string,
  toIso: string,
  maxResults = 20
): Promise<CalendarEventItem[]> {
  const token = await getAccessToken(integration);
  const params = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $top: String(maxResults),
    $orderby: "start/dateTime",
    $select: "id,subject,start,end,isAllDay,location,webLink",
  });
  const res = await fetch(`${GRAPH_BASE}/calendarView?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`[MS Calendar] list: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.value ?? [];
  return items.map((ev) => {
    const startStr = ev.start?.dateTime ? `${ev.start.dateTime}Z` : "";
    const endStr = ev.end?.dateTime ? `${ev.end.dateTime}Z` : startStr;
    return {
      id: ev.id,
      title: ev.subject ?? "(sin título)",
      start: startStr,
      end: endStr,
      allDay: !!ev.isAllDay,
      location: ev.location?.displayName || undefined,
      htmlLink: ev.webLink || undefined,
    };
  });
}

// Crear evento en Outlook Calendar
export async function createMicrosoftCalendarEvent(
  integration: UserIntegration,
  event: { title: string; startDatetime: string; endDatetime: string; description?: string }
): Promise<{ id: string; htmlLink: string }> {
  const token = await getAccessToken(integration);
  const body = {
    subject: event.title,
    body: { contentType: "Text", content: event.description ?? "" },
    start: { dateTime: event.startDatetime, timeZone: "Europe/Madrid" },
    end: { dateTime: event.endDatetime, timeZone: "Europe/Madrid" },
  };
  const res = await fetch(`${GRAPH_BASE}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`[MS Calendar] createEvent: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, htmlLink: data.webLink ?? "" };
}
