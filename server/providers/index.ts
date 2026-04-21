/**
 * Dispatcher: dada una integración, devuelve su proveedor correspondiente.
 */
import type { UserIntegration } from "../../drizzle/schema";
import { googleProvider, createGoogleCalendarEvent } from "./google";
import { microsoftProvider, createMicrosoftCalendarEvent } from "./microsoft";
import { imapProvider } from "./imap";
import type { MailProvider } from "./types";

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

export { googleProvider, microsoftProvider, imapProvider };
export type { MailProvider } from "./types";
