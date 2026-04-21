/**
 * PM2 — tuconsejo.app (Consejo Sinérgico / 8 Asesores)
 * Carga .env desde el directorio del proyecto para que PORT/HOST coincidan con el vhost (ej. 3334).
 */
const path = require("path");
// Mismo directorio que este archivo (raíz del proyecto en el servidor)
const appRoot = __dirname;

require("dotenv").config({ path: path.join(appRoot, ".env") });

const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";

module.exports = {
  apps: [
    {
      name: "tuconsejo",
      cwd: appRoot,
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        HOST: host,
      },
    },
  ],
};
