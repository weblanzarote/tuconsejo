/**
 * Hook de autenticación local para la versión standalone.
 * Usa fetch directo a /api/auth/* en lugar del OAuth de Manus.
 */
import { useState, useEffect, useCallback } from "react";

export interface LocalUser {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  onboardingCompleted: boolean;
  guardianEnabled: boolean;
  valuesFrameworkName?: string | null;
}

interface AuthState {
  user: LocalUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// Estado global compartido entre instancias del hook
let globalUser: LocalUser | null = null;
let globalLoading = true;
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function fetchMe(): Promise<LocalUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Inicializar al cargar
let initialized = false;
async function initialize() {
  if (initialized) return;
  initialized = true;
  globalUser = await fetchMe();
  globalLoading = false;
  notifyListeners();
}
initialize();

export function useLocalAuth() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? "Error al iniciar sesión" };
        globalUser = data.user;
        notifyListeners();
        return { success: true };
      } catch {
        return { success: false, error: "Error de conexión" };
      }
    },
    []
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      name?: string,
      email?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password, name, email }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? "Error al registrarse" };
        globalUser = data.user;
        notifyListeners();
        return { success: true };
      } catch {
        return { success: false, error: "Error de conexión" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      globalUser = null;
      notifyListeners();
    }
  }, []);

  const refresh = useCallback(async () => {
    globalUser = await fetchMe();
    notifyListeners();
  }, []);

  return {
    user: globalUser,
    loading: globalLoading,
    error: null as string | null,
    isAuthenticated: globalUser !== null,
    login,
    register,
    logout,
    refresh,
  };
}
