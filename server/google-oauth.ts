/**
 * Google OAuth2 para Gmail y Google Calendar.
 * Registra las rutas REST necesarias para el flujo de autorización.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import {
  getIntegrationByUser,
  upsertOAuthIntegration,
  getIntegrationByEmail,
  deleteIntegrationById,
} from "./db";
import { getUserFromRequest } from "./auth-local";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ─── Helpers de token ─────────────────────────────────────────────────────────
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Google OAuth] exchangeCode failed: ${err}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Google OAuth] refreshToken failed: ${err}`);
  }
  return res.json();
}

export async function getValidAccessToken(userId: number): Promise<string> {
  const integration = await getIntegrationByUser(userId, "google");
  if (!integration) {
    throw new Error("GOOGLE_NOT_CONNECTED");
  }

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const expiry = integration.tokenExpiry ? integration.tokenExpiry.getTime() : 0;

  if (integration.accessToken && expiry > now + fiveMinutes) {
    return integration.accessToken;
  }

  // Refrescar token
  if (!integration.refreshToken) throw new Error("GOOGLE_NO_REFRESH_TOKEN");
  const fresh = await refreshAccessToken(integration.refreshToken);
  const newExpiry = new Date(now + fresh.expires_in * 1000);
  await upsertOAuthIntegration(userId, "google", integration.connectedEmail, {
    accessToken: fresh.access_token,
    refreshToken: integration.refreshToken,
    tokenExpiry: newExpiry,
  });
  return fresh.access_token;
}

async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data as any).email ?? "";
}

// ─── Rutas Express ────────────────────────────────────────────────────────────
export function registerGoogleOAuthRoutes(app: Express) {
  // GET /api/auth/google — inicia el flujo OAuth
  app.get("/api/auth/google", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    // Guardar state en cookie corta (10 min)
    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    res.redirect(buildGoogleAuthUrl(state));
  });

  // GET /api/auth/google/callback — Google redirige aquí tras el consentimiento
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.redirect("/?error=not_authenticated");
        return;
      }

      // Validar state anti-CSRF
      const cookieHeader = req.headers.cookie ?? "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [k, ...v] = c.trim().split("=");
          return [k.trim(), decodeURIComponent(v.join("="))];
        })
      );
      const storedState = cookies["google_oauth_state"];
      const returnedState = req.query.state as string;

      if (!storedState || storedState !== returnedState) {
        res.redirect("/senales?error=invalid_state");
        return;
      }

      const code = req.query.code as string;
      if (!code) {
        res.redirect("/senales?error=no_code");
        return;
      }

      // Canjear code por tokens
      const tokens = await exchangeCodeForTokens(code);
      const connectedEmail = await getGoogleUserEmail(tokens.access_token);
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      await upsertOAuthIntegration(user.id, "google", connectedEmail, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      });

      // Limpiar state cookie
      res.clearCookie("google_oauth_state", { path: "/" });
      res.redirect("/senales");
    } catch (err) {
      console.error("[Google OAuth] callback error:", err);
      res.redirect("/senales?error=oauth_failed");
    }
  });

  // GET /api/auth/google/status — estado de la conexión
  app.get("/api/auth/google/status", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const integration = await getIntegrationByUser(user.id, "google");
    res.json({
      connected: !!integration,
      email: integration?.connectedEmail ?? null,
    });
  });

  // POST /api/auth/google/disconnect — desconectar Gmail
  app.post("/api/auth/google/disconnect", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const integration = await getIntegrationByUser(user.id, "google");
    if (integration) {
      await deleteIntegrationById(user.id, integration.id);
    }
    res.json({ success: true });
  });
}
