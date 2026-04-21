# Consejo Sinérgico - TODO

## Fase 1: Base de Datos y Agentes
- [x] Esquema de base de datos (usuarios, conversaciones, mensajes, tareas, bóveda, memoria)
- [x] Definición de los 6 agentes de IA con system prompts únicos
- [x] Helpers de base de datos (db.ts)
- [x] tRPC routers: auth, bóveda, conversaciones, mensajes, tareas, sala de juntas

## Fase 2: Estilos y Layout
- [x] Paleta de colores oscura premium (index.css)
- [x] Fuentes Google (Inter + Playfair Display)
- [x] Layout principal con navegación lateral
- [x] Componente CouncilLayout personalizado
- [x] Rutas en App.tsx

## Fase 3: Onboarding
- [x] Página de bienvenida / landing
- [x] Cuestionario multi-paso (5 pasos)
- [x] Paso 1: Información personal básica
- [x] Paso 2: Estado financiero y carrera
- [x] Paso 3: Salud y bienestar
- [x] Paso 4: Relaciones y familia
- [x] Paso 5: Valores y activación del Guardián
- [x] Guardar datos en La Bóveda al completar

## Fase 4: Dashboard Principal
- [x] Página Dashboard con 6 avatares de asesores
- [x] Pulsos de estado en tiempo real por asesor
- [x] Tarjetas de resumen de actividad reciente
- [x] Indicador de conflictos entre planes
- [x] Acceso rápido a Sala de Juntas

## Fase 5: Chat con Plan de Acción
- [x] Interfaz de chat dividida (split-screen)
- [x] Panel izquierdo: conversación con asesor
- [x] Panel derecho: Plan de Acción dinámico
- [x] Checklists con deadlines
- [x] Barras de progreso
- [x] Botón "Agregar al Plan" para convertir consejo en tarea
- [x] Renderizado de markdown en mensajes
- [x] Sistema de memoria contextual por asesor

## Fase 6: Sala de Juntas
- [x] Página Sala de Juntas
- [x] Chat global con todos los asesores
- [x] Debate simultáneo entre agentes
- [x] Conciencia cruzada (lectura de planes de otros agentes)
- [x] Identificación de conflictos entre asesores

## Fase 7: Sistema de Memoria
- [x] Almacenamiento de historial de conversaciones
- [x] Poda automática cada 10 mensajes (resumen)
- [x] Actualización del perfil del usuario
- [x] Contexto compartido entre agentes

## Fase 8: La Bóveda
- [x] Página de La Bóveda (perfil completo)
- [x] Visualización de datos del usuario
- [x] Edición de secciones individuales
- [x] CV, estado financiero, salud, relaciones

## Fase 9: Pulido Final
- [x] Diseño responsive (móvil y escritorio)
- [x] Pruebas vitest (12 tests pasados)
- [x] Checkpoint final
- [x] Copia al escritorio del usuario

## Fase 10: Adaptación para Instalación Local
- [ ] Migrar base de datos de MySQL a SQLite (better-sqlite3 + drizzle)
- [ ] Actualizar schema.ts para SQLite
- [ ] Actualizar db.ts para SQLite
- [ ] Reemplazar OAuth Manus por autenticación local (bcrypt + JWT)
- [ ] Crear endpoint POST /api/auth/register y POST /api/auth/login
- [ ] Actualizar ENV para usar OPENAI_API_KEY y OPENAI_MODEL
- [ ] Adaptar helper invokeLLM para OpenAI API directo
- [ ] Actualizar frontend: pantalla de login/registro local
- [ ] Eliminar referencias a Manus OAuth en el frontend
- [ ] Crear .env.example con todas las variables necesarias
- [ ] Crear README.md con guía de instalación paso a paso
- [ ] Crear script setup.sh para automatizar la instalación
- [ ] Generar ZIP final para el escritorio del usuario
