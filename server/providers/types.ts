/**
 * Interfaz común para los proveedores de correo (Google, Microsoft, IMAP).
 * Cada proveedor implementa las mismas operaciones básicas.
 */
import type { UserIntegration } from "../../drizzle/schema";

export interface MessageMeta {
  providerMessageId: string;
  threadId?: string;
}

export interface MessageDetail {
  providerMessageId: string;
  threadId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  snippet: string;
  fullBody: string;
  receivedAt: Date;
  inReplyToHeader?: string;
}

export interface MailProvider {
  /** Obtiene IDs de los últimos N mensajes del inbox */
  fetchRecent(integration: UserIntegration, maxResults?: number): Promise<MessageMeta[]>;

  /** Obtiene el contenido detallado de un mensaje */
  fetchDetail(integration: UserIntegration, messageId: string): Promise<MessageDetail | null>;

  /** Envía un email como respuesta */
  send(
    integration: UserIntegration,
    to: string,
    subject: string,
    body: string,
    inReplyTo?: string
  ): Promise<{ id: string }>;
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
