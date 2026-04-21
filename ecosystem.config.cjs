/**
 * PM2 — tuconsejo.app (Consejo Sinérgico / 8 Asesores)
 * El despliegue carga variables desde .env antes de arrancar.
 */
module.exports = {
  apps: [
    {
      name: "tuconsejo",
      cwd: "/home/tuconsejo.app/public_html",
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
