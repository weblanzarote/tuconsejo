/**
 * Dispatcher: dada una integración, devuelve su proveedor correspondiente.
 */
import type { UserIntegration } from "../../drizzle/schema";
import { googleProvider, createGoogleCalendarEvent, listGoogleUpcomingEvents } from "./google";
import { microsoftProvider, createMicrosoftCalendarEvent, listMicrosoftUpcomingEvents } from "./microsoft";
import { imapProvider } from "./imap";
import type { MailProvider } from "./types";
import type { CalendarEventItem } from "./google";

export function getProvider(integration: UserIntegration): MailProvider {
  switch (integration.provider) {
    case "google":
      return googleProvider;
    case "microsoft":
      return microsoftProvider;
    case "imap":
      return imapProvider;
    default:
      throw new Error(`Provider no soportado: ${integration.provider}`);
  }
}

/** Crea un evento de calendario. Solo Google y Microsoft lo soportan. */
export async function createCalendarEventForIntegration(
  integration: UserIntegration,
  event: { title: string; startDatetime: string; endDatetime: string; description?: string }
): Promise<{ id: string; htmlLink: string }> {
  if (integration.provider === "google") {
    return createGoogleCalendarEvent(integration, event);
  }
  if (integration.provider === "microsoft") {
    return createMicrosoftCalendarEvent(integration, event);
  }
  throw new Error("CALENDAR_NOT_SUPPORTED_FOR_PROVIDER");
}

/** Lista eventos próximos para una integración. Solo Google/Microsoft soportan calendario. */
export async function listUpcomingEventsForIntegration(
  integration: UserIntegration,
  fromIso: string,
  toIso: string,
  maxResults = 20
): Promise<CalendarEventItem[]> {
  if (integration.provider === "google") {
    return listGoogleUpcomingEvents(integration, fromIso, toIso, maxResults);
  }
  if (integration.provider === "microsoft") {
    return listMicrosoftUpcomingEvents(integration, fromIso, toIso, maxResults);
  }
  return [];
}

export { googleProvider, microsoftProvider, imapProvider };
export type { MailProvider } from "./types";
export type { CalendarEventItem } from "./google";
