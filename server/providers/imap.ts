/**
 * Proveedor de correo IMAP/SMTP genérico.
 * Funciona con cualquier servidor de correo (corporativo, ProtonMail Bridge,
 * Zoho, cPanel, etc.) usando credenciales del usuario.
 */
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { UserIntegration } from "../../drizzle/schema";
import { decrypt } from "../crypto-utils";
import type { MailProvider, MessageDetail, MessageMeta } from "./types";
import { parseFrom } from "./types";

function buildImapClient(integration: UserIntegration): ImapFlow {
  if (!integration.imapHost || !integration.imapUsername || !integration.imapPasswordEncrypted) {
    throw new Error("IMAP_MISSING_CONFIG");
  }
  const password = decrypt(integration.imapPasswordEncrypted);
  return new ImapFlow({
    host: integration.imapHost,
    port: integration.imapPort ?? 993,
    secure: (integration.imapPort ?? 993) === 993,
    auth: {
      user: integration.imapUsername,
      pass: password,
    },
    logger: false,
    socketTimeout: 30_000,
  });
}

function buildSmtpTransport(integration: UserIntegration) {
  if (!integration.smtpHost || !integration.imapPasswordEncrypted) {
    throw new Error("SMTP_MISSING_CONFIG");
  }
  const password = decrypt(integration.imapPasswordEncrypted);
  return nodemailer.createTransport({
    host: integration.smtpHost,
    port: integration.smtpPort ?? 587,
    secure: integration.smtpSecure ?? false,
    auth: {
      user: integration.imapUsername ?? integration.connectedEmail,
      pass: password,
    },
  });
}

export const imapProvider: MailProvider = {
  async fetchRecent(integration, maxResults = 30) {
    const client = buildImapClient(integration);
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const status = await client.status("INBOX", { messages: true });
        const total = status.messages ?? 0;
        if (total === 0) return [];
        const startSeq = Math.max(1, total - maxResults + 1);
        const range = `${startSeq}:${total}`;
        const results: MessageMeta[] = [];
        for await (const msg of client.fetch(range, { uid: true, envelope: true })) {
          const messageIdHeader = msg.envelope?.messageId ?? `${integration.id}-${msg.uid}`;
          results.push({
            providerMessageId: String(msg.uid),
            threadId: messageIdHeader,
          });
        }
        return results.reverse(); // más recientes primero
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  },

  async fetchDetail(integration, messageId) {
    const client = buildImapClient(integration);
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uid = parseInt(messageId, 10);
        if (isNaN(uid)) return null;
        const msg = await client.fetchOne(String(uid), { uid: true, source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) return null;

        const parsed = await simpleParser(msg.source);
        const fromRaw = parsed.from?.text ?? "";
        const { name: fromName, address: fromAddress } = parseFrom(fromRaw);
        const fullBody = (parsed.text ?? parsed.html ?? "").toString().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        return {
          providerMessageId: String(uid),
          threadId: parsed.messageId ?? String(uid),
          subject: parsed.subject ?? "(sin asunto)",
          fromName: fromName || parsed.from?.value?.[0]?.name || "",
          fromAddress: fromAddress || parsed.from?.value?.[0]?.address || "",
          snippet: fullBody.slice(0, 200),
          fullBody: fullBody.slice(0, 5000),
          receivedAt: parsed.date ?? new Date(),
          inReplyToHeader: parsed.messageId ?? undefined,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  },

  async send(integration, to, subject, body, inReplyTo) {
    const transport = buildSmtpTransport(integration);
    const result = await transport.sendMail({
      from: integration.connectedEmail,
      to,
      subject,
      text: body,
      inReplyTo: inReplyTo ? `<${inReplyTo}>` : undefined,
      references: inReplyTo ? `<${inReplyTo}>` : undefined,
    });
    return { id: result.messageId ?? "sent" };
  },
};

/**
 * Verifica que las credenciales IMAP/SMTP son válidas conectando
 * (sin guardar nada).
 */
export async function testImapConnection(params: {
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  // Probar IMAP
  const imap = new ImapFlow({
    host: params.imapHost,
    port: params.imapPort,
    secure: params.imapPort === 993,
    auth: { user: params.imapUsername, pass: params.imapPassword },
    logger: false,
    socketTimeout: 15_000,
  });
  try {
    await imap.connect();
    await imap.logout();
  } catch (err: any) {
    return { ok: false, error: `IMAP: ${err.message ?? "conexión fallida"}` };
  }
  // Probar SMTP
  const smtp = nodemailer.createTransport({
    host: params.smtpHost,
    port: params.smtpPort,
    secure: params.smtpSecure,
    auth: { user: params.imapUsername, pass: params.imapPassword },
    connectionTimeout: 15_000,
  });
  try {
    await smtp.verify();
  } catch (err: any) {
    return { ok: false, error: `SMTP: ${err.message ?? "conexión fallida"}` };
  }
  return { ok: true };
}
