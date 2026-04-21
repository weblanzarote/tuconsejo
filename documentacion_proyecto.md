# Contexto del Proyecto: "8 Asesores" (Consejo Sinérgico)

## 1. Visión General y Propósito
El proyecto **"8 Asesores"** es una aplicación web local de productividad avanzada y desarrollo personal basada en una arquitectura Multi-Agente (IA). Actúa como un "Consejo Sinérgico" privado para el usuario, donde diferentes agentes especializados le asisten en diversas áreas de su vida diaria.

El objetivo principal de la aplicación es centralizar la gestión de vida del usuario, mantener un contexto enriquecido de quién es y qué quiere lograr, y usar ese contexto para ofrecer apoyo proactivo mediante inteligencia artificial.

---

## 2. Pila Tecnológica (Tech Stack)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS. Funciona como una Single Page Application (SPA).
- **Backend:** Node.js (Express) con **tRPC** para tipado estricto de extremo a extremo, estructurado de forma modular (routers dedicados).
- **Base de datos:** Drizzle ORM con SQLite (`data/consejo.db`).
- **IA:** Integración con APIs de LLMs a los cuales se les inyecta contexto de forma dinámica mediante Prompts de Sistema complejos.

---

## 3. Navegación y Estructura de la Interfaz

### Sidebar principal
La barra lateral tiene 4 secciones de navegación:

| Ruta | Etiqueta | Descripción |
|------|----------|-------------|
| `/hoy` | Hoy | Diario diario, estado de ánimo, acceso rápido a asesores |
| `/correos` | Correos | Bandeja filtrada por IA (antes "Señales") |
| `/asesores` | Asesores | Chat con los agentes especializados |
| `/apuntes` | Apuntes | Notas, tareas y hábitos en un mismo espacio |

El **avatar del usuario** en la parte inferior del sidebar es clickable y navega a `/perfil` (antes "Bóveda"), donde el usuario puede editar su información personal.

### Rutas de compatibilidad
Las rutas antiguas `/senales`, `/vault` y `/notas` redirigen a las nuevas páginas para no romper enlaces existentes.

---

## 4. Módulos Principales

### A) Mi Perfil (antes "La Bóveda")
Ruta: `/perfil`

Almacena de forma centralizada toda la información estructurada del usuario: situación financiera, carrera profesional, salud, relaciones, círculo familiar y valores éticos. Toda IA que interactúa con el usuario lee primero este perfil para contextualizar profundamente sus respuestas.

Secciones del perfil:
- Perfil Personal (nombre, edad, ubicación, idiomas)
- Estado Financiero (ingresos, ahorros, deudas, metas)
- Carrera & Talento (rol actual, empresa, habilidades)
- Salud & Vitalidad (métricas físicas, sueño, ejercicio)
- Relaciones Íntimas (pareja, dinámica relacional)
- Círculo & Familia (miembros, roles, dinámicas)
- Valores & Propósito (marco filosófico y ético)

Acceso: click en el avatar/nombre de usuario en la parte inferior del sidebar.

---

### B) El Consejo (Agentes Especializados)
Ruta: `/asesores` y `/chat/:agentId`

Existen 6 asesores especializados + 1 sala de debate colectivo:

| ID | Nombre | Dominio |
|----|--------|---------|
| `economia` | Alejandro | Economía & Riqueza |
| `carrera` | Valentina | Carrera & Talento |
| `salud` | Dr. Marcos | Salud & Vitalidad |
| `relaciones` | Sofía | Relaciones Íntimas |
| `familia` | Elena | Círculo & Familia |
| `guardian` | El Guardián | Valores & Propósito |
| `sala_juntas` | Sala de Juntas | Debate colectivo multi-agente |

Existe un sistema de enrutamiento predictivo: al plantear una duda general, un clasificador LLM decide qué asesores son relevantes y lanza consultas asíncronas en paralelo.

**Chat con contexto pre-cargado:** La ruta `/chat/:agentId?contexto=...` acepta un parámetro de query que pre-rellena el input del chat automáticamente. Esto se usa al hacer click en "Hablar con [asesor]" desde una tarea o hábito.

Cada agente emite respuestas en un formato estricto que incluye:
- Diagnóstico (máximo 3 líneas)
- Tabla de Plan de Acción (markdown)
- Bloque JSON con `actionItems` clasificados por `tipo` (tarea o hábito)

---

### C) Correos (antes "Señales")
Ruta: `/correos`

Módulo gestor del ruido del correo electrónico.

**Cuentas soportadas:**
- Google (Gmail) — OAuth2
- Microsoft (Outlook) — OAuth2
- Cualquier proveedor — IMAP/SMTP con credenciales manuales (cifradas en reposo)

El usuario puede conectar **múltiples cuentas** simultáneamente. Cada cuenta se identifica por proveedor, dirección y etiqueta opcional (ej. "Trabajo", "Personal").

**Flujo de sincronización:**
1. Se obtienen los últimos 30 correos de cada cuenta conectada.
2. Un LLM actúa como filtro inteligente: descarta boletines, notificaciones automáticas, marketing y spam.
3. El filtro incorpora las **preferencias personales del usuario** (ver abajo).
4. Solo se presentan los correos que requieren acción real.

**Preferencias de filtrado:** El usuario puede describir en texto libre qué correos quiere ver y cuáles ignorar (ej. "Prioriza correos de clientes. Ignora newsletters aunque no sean spam."). Estas preferencias se guardan en la base de datos y se inyectan en el prompt del filtro LLM en cada sincronización.

**Acciones por correo:**
- Generar borrador de respuesta con IA (instrucción libre + edición del borrador)
- Convertir en tarea (con prioridad, fecha límite, opción de crear evento en Google Calendar)
- Ignorar

---

### D) Apuntes (Notas + Tareas + Hábitos)
Ruta: `/apuntes`

Espacio unificado con tres pestañas diferenciadas:

#### Pestaña: Notas
Sistema de toma de apuntes rápidos con:
- Guardado automático (debounce 1 segundo)
- Categorías: Idea, Recordatorio, Compra, Proyecto, Nota libre
- Fijado de notas (pin)
- Búsqueda de texto completo

#### Pestaña: Tareas
Items del plan de acción de tipo `"tarea"` — acciones concretas con inicio y fin definido.

- Filtro por estado: Todas / Pendientes / En progreso / Completadas
- El estado cicla haciendo click en el icono: pendiente → en progreso → completada
- Cada card es expandible y muestra descripción completa, métrica y valor objetivo

#### Pestaña: Hábitos
Items del plan de acción de tipo `"habito"` — prácticas recurrentes que se mantienen en el tiempo (rutinas, hábitos diarios, comportamientos a sostener).

- Sin flujo de "completar": los hábitos son continuos, no finitos
- Misma estructura de card expandible que las tareas

#### Cards expandibles (Tareas y Hábitos)
Al expandir una card se muestran:
1. Descripción completa
2. Métrica y valor objetivo (si los tiene)
3. **Botón "Hablar con [nombre del asesor]"** — navega directamente al chat con ese asesor con el mensaje pre-cargado sobre esa tarea/hábito específica
4. **Botón "Convertir en hábito/tarea"** — permite reclasificar el item manualmente en cualquier momento

#### Clasificación automática por los agentes
Todos los agentes del Consejo (incluida la Sala de Juntas y el Check-in semanal) emiten en su JSON el campo `"tipo": "tarea|habito"`, de modo que al guardar un plan de acción desde el chat los items quedan automáticamente clasificados.

---

### E) Módulos de Reflexión

#### Diario (Journaling)
Ruta: `/hoy`

Registro diario con seguimiento del estado de ánimo (bien / regular / mal). El contexto del diario se inyecta en las conversaciones del día con los asesores.

---

## 5. Base de Datos — Esquema Principal

| Tabla | Propósito | Campos clave |
|-------|-----------|--------------|
| `users` | Cuentas de usuario | `username`, `name`, `onboardingCompleted`, `guardianEnabled`, `emailFilterPrefs` |
| `vault` | Perfil personal del usuario | `personalInfo`, `financialStatus`, `careerData`, `healthMetrics`, `relationshipStatus`, `familyCircle`, `valuesFramework` |
| `conversations` | Historial de chats por agente | `userId`, `agentId`, `summary`, `messageCount` |
| `messages` | Mensajes individuales | `conversationId`, `role`, `content`, `structuredData` |
| `action_items` | Tareas y hábitos del plan de acción | `agentId`, `title`, `priority`, `status`, `tipo`, `deadline`, `metrica`, `valorObjetivo` |
| `memory_entries` | Memoria contextual por agente | `agentId`, `content`, `importance` |
| `diary_entries` | Entradas del diario | `date`, `content`, `mood` |
| `notes` | Notas del usuario | `title`, `content`, `tag`, `isPinned` |
| `user_integrations` | Cuentas de correo conectadas | `provider` (google/microsoft/imap), `connectedEmail`, `label`, tokens OAuth o credenciales IMAP cifradas |
| `email_signals` | Correos filtrados por IA | `subject`, `fromAddress`, `status` (pending/replied/ignored/converted), `draftReply`, `taskId` |

### Campo `tipo` en `action_items`
- `"tarea"` — acción concreta con inicio y fin definido (default para items existentes y nuevos sin clasificar)
- `"habito"` — práctica recurrente que se sostiene en el tiempo

### Campo `emailFilterPrefs` en `users`
Texto libre con las preferencias de filtrado de correo del usuario, inyectado en el prompt del LLM al sincronizar la bandeja.

---

## 6. Filosofía de "Memoria"
El sistema maneja el largo plazo podando las conversaciones. A medida que un chat con un agente crece, el sistema genera en segundo plano un resumen estructurado (usando la IA) y lo guarda como un objeto de memoria (*Memory Entry*) anclado a ese agente específico, limpiando el historial antiguo. Esto permite mantener los tokens LLM a raya mientras el sistema sigue "recordando" las decisiones clave consensuadas anteriormente.

---

## 7. Historial de Cambios Principales

### Ronda 1 — Renombrado y restructuración de navegación
- "Interior / Bóveda" → logo "Consejo" en el sidebar
- "Señales" → "Correos" (ruta `/correos`, página `CorreosPage.tsx`)
- "Bóveda" → "Mi Perfil" (ruta `/perfil`, accesible desde el avatar de usuario)
- Creada sección **"Apuntes"** en el nav lateral (`/apuntes`)
- La Sala de Juntas (`/boardroom`) y el Dashboard (`/dashboard`) quedan como rutas secundarias sin enlace directo en el sidebar principal

### Ronda 2 — Correos multi-cuenta y preferencias de filtrado
- Soporte completo para múltiples cuentas simultáneas: Google, Microsoft, IMAP/SMTP
- UI para añadir/eliminar cuentas con menú desplegable
- Sección colapsable de preferencias de filtrado (texto libre → se inyecta en el LLM)
- Campo `emailFilterPrefs` añadido a la tabla `users`
- Nuevo endpoint `signals.getEmailPrefs` / `signals.setEmailPrefs`

### Ronda 3 — Apuntes unificados (Notas + Tareas + Hábitos)
- `ApuntesPage.tsx` refactorizada con 3 pestañas: Notas / Tareas / Hábitos
- Campo `tipo: "tarea" | "habito"` añadido a `action_items` con migración automática (default `"tarea"`)
- Nuevo endpoint `actionPlan.updateTipo` para reclasificar items desde la UI
- Todos los prompts de los agentes actualizados para emitir `"tipo"` en el JSON
- Cards expandibles con botón **"Hablar con [asesor]"** → navega a `/chat/:agentId?contexto=...`
- `Chat.tsx` lee el parámetro `?contexto=` y pre-rellena el input al montar
- `handleSavePlan` en `Chat.tsx` pasa el campo `tipo` al guardar items del LLM
