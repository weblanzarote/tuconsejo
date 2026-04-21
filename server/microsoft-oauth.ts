/**
 * Microsoft OAuth2 (Outlook / Microsoft 365) vía Microsoft identity platform.
 * Registra las rutas REST para el flujo de autorización.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { upsertOAuthIntegration } from "./db";
import { getUserFromRequest } from "./auth-local";

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";
const MS_REDIRECT_URI =
  process.env.MICROSOFT_REDIRECT_URI ?? "http://localhost:3000/api/auth/microsoft/callback";
const MS_TENANT = process.env.MICROSOFT_TENANT ?? "common";

const SCOPES = "offline_access Mail.ReadWrite Mail.Send Calendars.ReadWrite User.Read";

function buildMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string) {
  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: MS_REDIRECT_URI,
      grant_type: "authorization_code",
      scope: SCOPES,
    }).toString(),
  });
  if (!res.ok) throw new Error(`[Microsoft] exchangeCode: ${await res.text()}`);
  return res.json();
}

async function getMicrosoftUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data as any).mail ?? (data as any).userPrincipalName ?? "";
}

export function registerMicrosoftOAuthRoutes(app: Express) {
  app.get("/api/auth/microsoft", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("ms_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
    res.redirect(buildMicrosoftAuthUrl(state));
  });

  app.get("/api/auth/microsoft/callback", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.redirect("/?error=not_authenticated");
        return;
      }

      const cookieHeader = req.headers.cookie ?? "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [k, ...v] = c.trim().split("=");
          return [k.trim(), decodeURIComponent(v.join("="))];
        })
      );
      const storedState = cookies["ms_oauth_state"];
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

      const tokens = await exchangeCodeForTokens(code);
      const connectedEmail = await getMicrosoftUserEmail(tokens.access_token);
      if (!connectedEmail) {
        res.redirect("/senales?error=no_email");
        return;
      }

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
      await upsertOAuthIntegration(user.id, "microsoft", connectedEmail, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      });

      res.clearCookie("ms_oauth_state", { path: "/" });
      res.redirect("/senales");
    } catch (err) {
      console.error("[Microsoft OAuth] callback error:", err);
      res.redirect("/senales?error=oauth_failed");
    }
  });
}
