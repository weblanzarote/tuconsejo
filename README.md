# 🔮 Consejo Sinérgico — Versión Local

Aplicación de gestión de vida personal impulsada por IA con 6 asesores especializados. Esta versión funciona completamente en tu equipo local usando tu propia API key de OpenAI y SQLite como base de datos.

---

## Requisitos previos

Antes de instalar, asegúrate de tener lo siguiente:

| Requisito | Versión mínima | Cómo verificar |
|---|---|---|
| **Node.js** | 18 o superior | `node --version` |
| **pnpm** | 8 o superior | `pnpm --version` |
| **API key de OpenAI** | — | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Si no tienes `pnpm`, instálalo con: `npm install -g pnpm`

---

## Instalación paso a paso

### Paso 1 — Descomprimir el proyecto

Descomprime el archivo ZIP en la carpeta donde quieras instalar la aplicación, por ejemplo `C:\Aplicaciones\consejo-sinergico` en Windows o `~/apps/consejo-sinergico` en macOS/Linux.

### Paso 2 — Instalar dependencias

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
pnpm install
```

En Windows, puede que necesites ejecutar primero:
```bash
pnpm approve-builds
```
Y seleccionar `better-sqlite3` con la tecla `a` (seleccionar todo) y luego Enter.

### Paso 3 — Configurar las variables de entorno

Crea un archivo llamado `.env` en la raíz del proyecto con el siguiente contenido:

```
OPENAI_API_KEY=sk-proj-TU_API_KEY_AQUI
OPENAI_MODEL=gpt-4o-mini
JWT_SECRET=una-clave-secreta-larga-y-aleatoria
PORT=3000
NODE_ENV=production
```

**Importante:** Reemplaza `sk-proj-TU_API_KEY_AQUI` con tu API key real de OpenAI. Para generar una `JWT_SECRET` segura, ejecuta en la terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Modelos de OpenAI disponibles

| Modelo | Coste | Recomendado para |
|---|---|---|
| `gpt-4o-mini` | Muy bajo (~$0.15/1M tokens) | Uso diario, conversaciones largas |
| `gpt-4o` | Medio (~$2.50/1M tokens) | Análisis complejos, Sala de Juntas |
| `gpt-4-turbo` | Alto (~$10/1M tokens) | Máxima calidad |

### Paso 4 — Compilar la aplicación

```bash
pnpm build
```

Este paso genera los archivos estáticos del frontend y compila el servidor. Solo es necesario hacerlo una vez (o cuando actualices el código).

### Paso 5 — Iniciar la aplicación

```bash
pnpm start
```

La aplicación se iniciará en `http://localhost:3000`. La base de datos SQLite se crea automáticamente en `./data/consejo.db` la primera vez que arranques.

---

## Uso en modo desarrollo

Si quieres modificar el código y ver los cambios en tiempo real:

```bash
pnpm dev
```

Esto inicia el servidor con recarga automática (hot-reload) en `http://localhost:3000`.

---

## Estructura de archivos importantes

```
consejo-sinergico/
├── .env                  ← Tu configuración (créalo tú, no está incluido)
├── data/
│   └── consejo.db        ← Base de datos SQLite (se crea automáticamente)
├── client/               ← Frontend React
├── server/               ← Backend Express + tRPC
│   ├── agents.ts         ← Definición de los 6 asesores de IA
│   ├── auth-local.ts     ← Sistema de autenticación local
│   └── routers.ts        ← API endpoints
└── drizzle/
    └── schema.ts         ← Esquema de la base de datos
```

---

## Personalización de los asesores

Los system prompts de los 6 asesores se encuentran en `server/agents.ts`. Puedes modificar sus personalidades, nombres y áreas de especialización editando ese archivo y reiniciando la aplicación.

---

## Copia de seguridad de tus datos

Todos tus datos (conversaciones, plan de acción, La Bóveda) se almacenan en el archivo `data/consejo.db`. Para hacer una copia de seguridad, simplemente copia ese archivo a otro lugar.

---

## Solución de problemas

**Error: "OPENAI_API_KEY no está configurada"**
Verifica que el archivo `.env` existe en la raíz del proyecto y contiene la variable `OPENAI_API_KEY`.

**Error al instalar `better-sqlite3` en Windows**
Necesitas las herramientas de compilación de C++. Instálalas con:
```bash
npm install -g windows-build-tools
```
O instala "Desktop development with C++" desde Visual Studio Build Tools.

**Puerto 3000 ocupado**
Cambia el puerto en el archivo `.env`: `PORT=3001`

**La base de datos no se crea**
Verifica que tienes permisos de escritura en la carpeta del proyecto. En macOS/Linux: `chmod 755 .`

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia en modo desarrollo con hot-reload |
| `pnpm build` | Compila para producción |
| `pnpm start` | Inicia la versión compilada |
| `pnpm test` | Ejecuta las pruebas automatizadas |

---

## Privacidad

Esta versión local almacena todos tus datos exclusivamente en tu equipo. Ningún dato se envía a servidores externos excepto las consultas a la API de OpenAI, que están sujetas a la [política de privacidad de OpenAI](https://openai.com/policies/privacy-policy).
