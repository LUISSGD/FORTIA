# Contexto del proyecto FORTIA (para continuar el trabajo)

Estado al 16/10/2026: PRs #1 a #33 de LUISSGD/FORTIA, todas mergeadas en `main`.
Léelo completo antes de cambiar algo. Si cambias una regla o agregas un módulo, actualiza este archivo en el mismo PR.

## Quién lo usa y cómo se trabaja
- Luis, coach y dueño del gimnasio FORTIA (Lima, ~45 clientes). No es técnico y habla español:
  explicarle todo paso a paso, en español latinoamericano con "tú", sin jerga.
- Flujo **siempre**: rama nueva desde `main` actualizado → commit → push → Luis abre el PR con el enlace
  `https://github.com/LUISSGD/FORTIA/compare/main...<rama>?expand=1` ("Create pull request" → "Merge pull
  request" → "Confirm merge") → Vercel publica producción (https://fortia-ten.vercel.app).
  No hay `gh` CLI. Luis suele olvidar un paso: tras su "ya hice el merge", verificar con
  `git fetch && git merge-base --is-ancestor origin/<rama> origin/main`.
- Comprobar el build sin el panel de Vercel: `curl https://api.github.com/repos/LUISSGD/FORTIA/commits/<sha>/status`
  (estado `success` = compiló y, en `main`, quedó publicado).
- Antes de publicar: `npx tsc --noEmit` (ignorar los errores previos de `nutrition/[id]/consulta`,
  `NutritionEditForm`, `nutrition/new`). El build local choca con el dev server que bloquea `.next`.
- **Nunca** pegar contraseñas ni secretos en el chat ni en el repo (van en `.env.local` y en Vercel).
  No iniciar sesión con contraseñas reales en la app publicada.
- Los archivos usan CRLF: en scripts de reemplazo normalizar `\r\n`.
- **Dos sesiones de Claude a la vez:** cada una en su propia rama y, de preferencia, en su propia copia
  del repo. Si comparten la misma carpeta (OneDrive), cambiar de rama en una cambia los archivos de la
  otra: coordinar y no trabajar en paralelo sobre la misma carpeta.

## Stack
- Next.js 16 (App Router, `proxy.ts` en lugar de middleware, tipos globales `PageProps<"/ruta">`).
  Leer `node_modules/next/dist/docs/` antes de usar APIs de Next (ver AGENTS.md).
- React 19, Tailwind 4, shadcn/base-ui, recharts, sonner 2, exceljs (también en el navegador), date-fns.
- Prisma 7.8 con `@prisma/adapter-pg`, cliente en `src/generated/prisma` (`npx prisma generate`). PostgreSQL en Supabase.
- NextAuth v5. Roles: `ADMIN` (Luis, todo), `USER` (staff), `CLIENT` (app del cliente), `NUTRITIONIST`,
  `TRAINER` (panel `/trainer`; `coach@fortia.pe`). Rutas permitidas por rol en `src/lib/auth.config.ts`
  (`TRAINER_ALLOWED_PREFIXES`). Guards en `src/lib/coaching/auth.ts` (`requireCoach`, `requireTrainer`,
  `requireCoachOrTrainer`, `requireTrainerPage`, `requireClient`).
- Scripts contra producción: `npx tsx --env-file=.env.local scripts/<script>.ts` (con modo reporte y `--apply`).

## Fechas (regla única, `src/lib/calendar.ts`)
- Las fechas de calendario se guardan al **mediodía UTC** y se leen con `calendarYmd()`.
  `CALENDAR_FIELDS` (scheduledDate, currentPackStart, membershipStart/End, birthDate, periodStart/End,
  prevMembershipStart/End, trialDate) se normaliza solo al escribir (extensión de Prisma en `src/lib/prisma.ts`).
- La fecha de una clase EP es siempre su `scheduledDate`. En el navegador no usar `toISOString()` para "hoy"
  (después de las 7 p. m. da el día siguiente): usar `calendarYmd(new Date())`.
- Los registros diarios del coaching guardan `"YYYY-MM-DD"` (`src/lib/coaching/dates.ts`).

## Base de datos y migraciones
- Corren **en el build de Vercel** (`scripts/migrate-production.mjs`, solo producción): `prisma migrate deploy`;
  si falla, aplica solo cambios aditivos. **Las migraciones deben ser aditivas** (escribir el SQL a mano o con
  `prisma migrate diff --from-schema <viejo> --to-schema prisma/schema.prisma --script` y quitar la línea
  "Loaded Prisma config"). Hay drift previo en producción: no arrastrarlo.
- Previews de Vercel usan la base demo (`PREVIEW_DATABASE_URL`): ahí no existen tablas nuevas hasta migrar.

## Módulos y reglas clave
- **Coaching** es la vista principal de los clientes: panel `src/app/(dashboard)/coaching/**`,
  app del cliente `src/app/(client)/app/**` (PWA), panel del entrenador `src/app/trainer/**`,
  APIs `src/app/api/{coaching,app,trainer}/**`, lógica `src/lib/coaching/*`.
- **Clientes ↔ Coaching** (`lifecycle.ts`): cliente inactivo = perfil STANDBY y viceversa (`setCoachingStatus`).
- **Pagos ↔ Finanzas ↔ Membresía** (`src/lib/finance-sync.ts`). `Payment.paidAt` = fecha del pago
  (define el mes en Finanzas; editable) = `Income.date`. Período del pago: membresía cubre del…al;
  clases EP y nutrición, un solo día.
- **Entrenamiento personal (EP)**: `ClientTrainingPlan` + `TrainingSession`.
  - La membresía vence el día de la **última clase** del paquete activo: `syncMembershipWithTraining()`
    (`personal-training.ts`) se llama al crear/renovar paquete, cambiar horario, mover clases o reprogramar;
    un paquete nuevo reactiva al cliente en stand-by.
  - Hora de cada clase: `TrainingSession.startTime` propia o la del horario semanal; si el día no está en el
    horario, la hora estándar del plan (`src/lib/session-time.ts`).
  - Entrenador asignado: `Client.trainer` ∈ `TRAINERS` (Julio, Piero) con colores en `src/lib/trainers.ts`;
    se ve en las agendas y en Hoy.
- **Parejas**: la 2ª persona tiene su propia ficha con `Client.partnerOfId` → ficha principal, que conserva
  membresía, plan EP y pagos compartidos (`sharedOwnerId()`); no se duplica en la lista de Clientes.
  Separar parejas nuevas: `scripts/split-couples.ts`.
- **Entrenador (TRAINER)**: Hoy (`/trainer/hoy`), agenda, clientes (rutinas, check-ins, chat), rutinas y ejercicios.
  **Solo consulta** lo que hacen los clientes: no registra entrenamientos por ellos (decisión de Luis).
- **Clases de prueba**: `TrialClass` (interesado, día, hora, entrenador, estado). Admin y entrenador las agendan
  (`/api/trainer/trials`); solo el admin las convierte en cliente (`/api/coaching/trials/[id]/convert`).
- **Reproductor de entrenamiento** (`WorkoutPlayer.tsx`): bloques y superseries a partir de las notas
  (`exercise-format.ts`), series por tiempo, sugerencia de peso (doble progresión), casillas vacías con lo
  sugerido en gris, ejercicio completo = todas sus series marcadas.
- **Chat**: canales COACHING y NUTRITION con autor (`CoachMessage.authorName`).
- **Mensualidades de coaching** (`CoachingPayment`): solo para clientes con precio en el perfil. Hoy nadie
  tiene precio: se cobra por la membresía; no usar "Generar mensualidades" sin precio configurado.
- Otras piezas: Web Push (VAPID), Mercado Pago (pendiente de credenciales), cron diario (`vercel.json`),
  importador Excel/CSV, exportación de clientes a .xlsx.

## Harbiz (ya migrado)
- Rutinas y videos de los 42 clientes de Harbiz están en Fortia (1.017/1.022 ejercicios idénticos).
  Harbiz solo se usa como fuente de datos: **no modificar nada en Harbiz**. Los scripts de migración
  (`scripts/migrate-harbiz*.ts`) no se suben al repo porque tienen nombres de clientes.

## Pendientes
1. Mercado Pago: Luis debe cargar `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en Vercel.
2. Dar acceso a la app a los clientes (Ajustes → Acceso → Generar → Enviar por WhatsApp).
3. Rutinas para los clientes activos sin rutina (no están en Harbiz) y para André Miranda.
4. 16 ejercicios sin video (esperando los enlaces de Luis).
