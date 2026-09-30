# Contexto del proyecto FORTIA (para continuar el trabajo)

Resumen del trabajo hecho en la sesión de Claude Code en la nube (PRs #1 a #9 de LUISSGD/FORTIA,
todas mergeadas en `main`). Léelo antes de cambiar el módulo de coaching.

## Quién lo usa y cómo se trabaja
- Luis, coach y dueño del gimnasio FORTIA (Lima, ~40 clientes). No es técnico y habla español:
  explicarle todo paso a paso, en español, sin jerga.
- Flujo: cambios en una rama → PR → Luis hace merge → Vercel publica producción
  (https://fortia-ten.vercel.app). Probar antes de publicar (`npm run build` + prueba en local).
- **Nunca** pegar contraseñas ni secretos en el chat ni en el repo: van en variables de entorno de Vercel.

## Stack
- Next.js 16 (App Router, `proxy.ts` en lugar de middleware, tipos globales `PageProps<"/ruta">`).
  Leer `node_modules/next/dist/docs/` antes de usar APIs de Next (ver AGENTS.md).
- React 19, Tailwind 4, shadcn/base-ui (en `Select` de base-ui, `SelectValue` muestra el valor crudo:
  pasar children `(v) => etiqueta`), recharts, sonner, exceljs, date-fns.
- Prisma 7.8 con `@prisma/adapter-pg`, cliente generado en `src/generated/prisma`. PostgreSQL en Supabase.
- NextAuth v5 (credenciales, JWT). Roles: `ADMIN` (coach, todo), `USER` (staff, restringido),
  `CLIENT` (cliente de coaching, solo `/app`, `/api/app`, `/api/push`). Reglas en `src/lib/auth.config.ts`.
- Zona horaria Lima. Los registros diarios del coaching guardan la fecha como texto `"YYYY-MM-DD"`
  (`src/lib/coaching/dates.ts`).

## Base de datos y migraciones
- Las migraciones de producción corren **en el build de Vercel** con `scripts/migrate-production.mjs`
  (solo si `VERCEL_ENV=production`): primero `prisma migrate deploy`; si falla, aplica solo cambios
  aditivos (CREATE TABLE/INDEX, ADD COLUMN/CONSTRAINT) y marca las migraciones como aplicadas.
- Por eso: **las migraciones deben ser aditivas**. Nada de cambiar tipos, borrar columnas, etc.
- La base de producción tiene "drift" previo (índice de NutritionClient, defaults de updatedAt,
  columnas de TrainingSession): al generar migraciones con `migrate diff`, quitar esas líneas.
- Previews de Vercel usan `PREVIEW_DATABASE_URL` si existe (base demo aparte), ver `src/lib/prisma.ts`.

## Módulo de coaching (lo principal)
Coaching es ahora **la vista principal de los clientes**. Todo está conectado con el resto de FORTIA:

- Panel del coach: `src/app/(dashboard)/coaching/**` (Dashboard, Clientes con filtros tipo Excel,
  ficha con pestañas Resumen / Plan y membresía / Entrenamiento / Nutrición / Progreso / Check-ins /
  Pagos / Chat / Documentos / Ajustes, Rutinas, Ejercicios, Nutrición, Agenda, Finanzas,
  Mensualidades, Mensajes, Documentos, Comunidad, Automatizaciones, Importar).
- App del cliente (PWA, tema oscuro): `src/app/(client)/app/**`.
- APIs: `src/app/api/coaching/**` (coach) y `src/app/api/app/**` (cliente).
- Lógica: `src/lib/coaching/*`.

### Conexiones con el resto de la app (no romperlas)
- **Clientes ↔ Coaching** (`src/lib/coaching/lifecycle.ts`): crear un cliente en Clientes crea su
  `CoachingProfile`; dar de baja (isActive=false) = estado `STANDBY` (ex cliente) y viceversa.
  Estados del perfil: ACTIVE, PAUSED, STANDBY, ENDED (ENDED revoca el acceso a la app).
- **Pagos ↔ Finanzas ↔ Membresía** (`src/lib/finance-sync.ts`): borrar un pago borra su `Income` y
  restaura la membresía anterior (foto guardada en `Payment.prevMembership*`); borrar un ingreso borra
  el pago vinculado, reabre la mensualidad de coaching o deja la consulta de nutrición como pendiente.
  `POST /api/payments` bloquea duplicados (mismo cliente y monto en 2 min).
- **Entrenamiento personal** (`ClientTrainingPlan`, `TrainingSession`): asignar/renovar puede registrar
  el pago (vinculado por `incomeId`); registrar un pago de entrenamiento puede crear el paquete; borrar
  uno borra el otro. El cliente marca "FUI A MI CLASE HOY" en la app (`src/lib/coaching/personal-training.ts`).
- **Nutrición**: cada consulta pasa medidas a `PhysicalRecord` y metas (kcal, macros, agua, objetivo) al
  perfil de coaching; si está pagada con monto, crea un ingreso categoría `NUTRITION` (vinculado por
  `NutritionConsultation.incomeId`).
- **Clases grupales**: la asistencia (`Attendance`) cuenta como entrenamiento en las estadísticas.
- Medidas: se usa la tabla existente `PhysicalRecord` en todo.

### Otras piezas
- Push: Web Push con VAPID (`public/sw.js`, `src/lib/coaching/push.ts`).
- Mercado Pago: Checkout Pro por REST + webhook con firma (`src/lib/coaching/mercadopago.ts`).
- Automatizaciones: cron diario de Vercel (`vercel.json`), protegido con `CRON_SECRET`.
- Importador Excel/CSV (`src/lib/coaching/import.ts`) y "Paso 0" que trae datos de FORTIA
  (`src/lib/coaching/sync-fortia.ts`).
- Semilla: `prisma/seed-coaching.ts` (biblioteca de 77 ejercicios y 225 alimentos; `--demo` agrega
  clientes de prueba).

## Pendientes
1. **Datos de Harbiz**: Harbiz no permite exportar y no tiene API pública. Opciones: pedir la
   exportación por derecho de portabilidad (RGPD) a su soporte, o que Luis mande capturas de rutinas y
   medidas y convertirlas a los Excel del importador (Coaching → Importar). Evitar extracción
   automatizada salvo como último recurso (términos de uso de Harbiz).
2. Asignar rutinas y planes de nutrición a los clientes.
3. Configurar en Vercel: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (push),
   `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`/`APP_URL` (Mercado Pago), `CRON_SECRET`.
4. Mensaje de WhatsApp de bienvenida para dar acceso a la app a los clientes.
5. Recordar a Luis que cambie la contraseña de la base demo de Supabase (la pegó en un chat) y
   actualice el secreto `DEMO_DATABASE_URL` de GitHub y la variable de Preview de Vercel.
6. Hay errores de TypeScript previos en páginas de nutrición (`nutrition/[id]/consulta`,
   `NutritionEditForm`, `nutrition/new`), ajenos al coaching; el build los ignora.
