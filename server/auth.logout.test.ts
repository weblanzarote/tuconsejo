import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Cookie name usado en la versión local
const LOCAL_COOKIE_NAME = "cs_session";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  // Usuario local (sin openId ni loginMethod — versión standalone)
  const user: AuthenticatedUser = {
    id: 1,
    username: "usuario_prueba",
    passwordHash: "$2b$12$hasheado",
    email: "prueba@example.com",
    name: "Usuario de Prueba",
    role: "user",
    onboardingCompleted: false,
    guardianEnabled: false,
    valuesFrameworkName: null,
    emailFilterPrefs: null,
    timezone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout (versión local)", () => {
  it("limpia la cookie de sesión y reporta éxito", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(LOCAL_COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      path: "/",
    });
  });
});
