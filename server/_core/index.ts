import "dotenv/config";
import express from "express";

if (!process.env.OPENAI_API_KEY?.trim()) {
  console.warn(
    "[Consejo Sinérgico] OPENAI_API_KEY no está definida en .env (raíz del proyecto). El chat y la sala de juntas no podrán llamar a la IA hasta que la configures."
  );
}
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerLocalAuthRoutes } from "../auth-local";
import { registerGoogleOAuthRoutes } from "../google-oauth";
import { registerMicrosoftOAuthRoutes } from "../microsoft-oauth";
import { initializeDatabase } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Inicializar base de datos SQLite
  initializeDatabase();
  // Rutas de autenticación local
  registerLocalAuthRoutes(app);
  // Rutas de Google OAuth (Gmail + Calendar)
  registerGoogleOAuthRoutes(app);
  // Rutas de Microsoft OAuth (Outlook / Microsoft 365)
  registerMicrosoftOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);

  // En producción el proxy (CyberPanel / OpenLiteSpeed) debe apuntar al mismo puerto
  // que PORT en .env — no buscar otro puerto libre ni dejar el bind ambiguo (IPv4 vs IPv6).
  if (process.env.NODE_ENV === "production") {
    const host = process.env.HOST ?? "0.0.0.0";
    server.once("error", (err: NodeJS.ErrnoException) => {
      console.error(`[Server] No se pudo escuchar en ${host}:${preferredPort}:`, err.message);
      if (err.code === "EADDRINUSE") {
        console.error(
          "[Server] Puerto en uso. Comprueba con: ss -tlnp | grep " + preferredPort
        );
      }
      process.exit(1);
    });
    server.listen(preferredPort, host, () => {
      console.log(`Server running on http://${host}:${preferredPort}/`);
    });
    return;
  }

  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
