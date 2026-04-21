/**
 * Autenticación local para la versión standalone del Consejo Sinérgico.
 * Reemplaza el OAuth de Manus con un sistema de usuario/contraseña + JWT.
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import { createUser, getUserByUsername, getUserById, updateUserLastSignedIn } from "./db";

const COOKIE_NAME = "cs_session";
const JWT_SECRET_RAW = process.env.JWT_SECRET ?? "consejo-sinergico-local-secret-change-me";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ─── JWT helpers ──────────────────────────────────────────────────────────────
export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const id = parseInt(payload.sub as string, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: ONE_YEAR_MS,
  };
}

// ─── Middleware: leer usuario desde cookie ────────────────────────────────────
export async function getUserFromRequest(req: Request) {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  return getUserById(userId);
}

// ─── Rutas de autenticación local ─────────────────────────────────────────────
export function registerLocalAuthRoutes(app: Express) {
  // POST /api/auth/register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { username, password, name, email } = req.body ?? {};

    if (!username || !password) {
      res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
      return;
    }
    if (typeof username !== "string" || username.length < 3) {
      res.status(400).json({ error: "El usuario debe tener al menos 3 caracteres" });
      return;
    }
    if (typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    try {
      const existing = await getUserByUsername(username);
      if (existing) {
        res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createUser({
        username,
        passwordHash,
        name: name ?? username,
        email: email ?? undefined,
      });

      const token = await createSessionToken(user.id);
      res.cookie(COOKIE_NAME, token, getCookieOptions());
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
          guardianEnabled: user.guardianEnabled,
        },
      });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
      return;
    }

    try {
      const user = await getUserByUsername(username);
      if (!user) {
        res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        return;
      }

      await updateUserLastSignedIn(user.id);
      const token = await createSessionToken(user.id);
      res.cookie(COOKIE_NAME, token, getCookieOptions());
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
          guardianEnabled: user.guardianEnabled,
        },
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.json(null);
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      onboardingCompleted: user.onboardingCompleted,
      guardianEnabled: user.guardianEnabled,
      valuesFrameworkName: user.valuesFrameworkName,
    });
  });
}

export { COOKIE_NAME };
