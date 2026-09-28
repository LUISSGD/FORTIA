# FORTIA

Sistema de gestión del gimnasio FORTIA (Next.js 16 + Prisma/PostgreSQL + Supabase Storage) con el módulo **FORTIA Coaching**: una app de coaching personalizada (panel del entrenador + app móvil del cliente) pensada para ~40 clientes.

## FORTIA Coaching

### Panel del entrenador (`/coaching`, rol ADMIN)
| Sección | Qué hace |
|---|---|
| 📊 Dashboard | KPIs (activos, entrenos de la semana, cumplimiento, check-ins, pagos, mensajes), semáforo 🟢🟡🔴 y lista de **clientes que requieren atención** (días sin entrenar, cumplimiento nutricional, check-in pendiente, peso estancado, pago vencido), check-ins por revisar, próximas sesiones y actividad reciente. |
| 👥 Clientes | Alta desde un cliente del gimnasio o nuevo, acceso a la app (email + contraseña). Perfil individual con pestañas: resumen, entrenamiento (programa, historial, **progresión por ejercicio** con 1RM estimado), nutrición (registro de 14 días), progreso (medidas, gráficos, fotos comparativas), check-ins (con respuesta del coach), pagos, chat, documentos y ajustes (objetivos de macros con sugerencia Mifflin-St Jeor). |
| 🏋️ Rutinas | Creador de rutinas: días, ejercicios, series, reps, descanso, RIR, tempo, carga y notas. Plantillas asignables a varios clientes (cada uno recibe su copia editable). |
| 🎥 Ejercicios | Biblioteca base de 77 ejercicios (músculos, equipamiento, instrucciones, errores comunes) + ejercicios propios con video (YouTube/Vimeo). |
| 🥗 Nutrición | Planes con **opciones A/B/C por comida**, cálculo automático de kcal/macros, biblioteca de 225 alimentos habituales (por 100 g, con porciones). |
| 📅 Agenda | Horarios disponibles (recurrentes, cupos, presencial/online), reservas, lista de espera automática, asistencia. |
| 💳 Pagos | Mensualidades por cliente; al marcar pagado se registra el ingreso “Coaching online” en Finanzas. **Pagos online con Mercado Pago**: el cliente paga desde su app (o le envías el link de pago 🔗) y la mensualidad se marca como pagada automáticamente. |
| 💬 Mensajes | Chat por cliente (texto, fotos, videos, audios, PDFs) y mensajes masivos con `{nombre}`. |
| 📄 Documentos | PDFs, videos, enlaces para todos o para un cliente. |
| 🏆 Comunidad | Retos mensuales con progreso y ranking opcional. |
| 📥 Importar | Importa **clientes, medidas y rutinas** desde Excel/CSV (exportaciones de Harbiz u otra plataforma). Reconoce columnas en español e inglés, muestra una vista previa antes de guardar y ofrece plantillas descargables. |
| ⚙️ Automatizaciones | Inactividad, semana completada, cumpleaños, entrenamiento del día, recordatorio de nutrición, check-in de los domingos, recordatorio de sesión y de pago. Sin envíos duplicados. |

### App del cliente (`/app`, rol CLIENT, instalable como PWA)
Menú inferior: 🏠 Inicio · 🏋️ Entreno · 🥗 Nutrición · 📈 Progreso · 👤 Perfil, y chat flotante.
- **Entrenamiento de hoy** con registro de series (peso anterior precargado), video, temporizador de descanso, feedback por ejercicio y resumen final (duración, volumen, récords personales). El progreso se guarda localmente si se cierra la app.
- **Nutrición**: elige opción A/B/C, marca comidas, extras fuera del plan, macros vs objetivo, agua, lista de compras semanal.
- **Progreso**: peso/medidas con gráficos, fotos frente/perfil/espalda y comparación entre fechas, objetivos y logros.
- **Notificaciones push** en el celular (entrenamiento del día, recordatorios, mensajes y respuestas del coach, reservas, pagos). El cliente las activa desde Inicio o Perfil; en iPhone primero debe “Agregar a inicio” (iOS 16.4+). El entrenador las activa con “Activar push” en el dashboard y recibe los avisos de entrenos, check-ins, reservas y mensajes.
- **Pago de la mensualidad con Mercado Pago** (tarjeta, Yape y demás medios habilitados en tu cuenta) desde Perfil.
- **Check-in semanal**, reservas, documentos, retos, notificaciones y cambio de contraseña.

### Puesta en marcha
1. Aplicar la migración: `npx prisma migrate deploy` (crea las tablas de coaching; no modifica datos existentes).
2. Cargar la biblioteca base: botón **“Cargar biblioteca base”** en `/coaching`, o `npm run db:seed-coaching`.
   - Datos de ejemplo para probar: `npx tsx prisma/seed-coaching.ts --demo` (cliente demo `carlos@demo.fortia.pe` / `fortia123`). No usar en producción.
3. Variables de entorno adicionales:
   - `CRON_SECRET`: protege el cron diario de automatizaciones (`vercel.json`, 8:00 hora de Lima).
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (ej. `mailto:tu@correo.com`): notificaciones push al celular. Genera las claves una sola vez con `npx web-push generate-vapid-keys` y no las cambies después (invalidaría las suscripciones). Sin ellas la app funciona igual, solo sin push.
   - `MP_ACCESS_TOKEN`: Access Token de producción de tu aplicación de Mercado Pago (Tus integraciones → Credenciales). Sin él, los pagos online quedan ocultos.
   - `MP_WEBHOOK_SECRET`: clave secreta de Webhooks (Tus integraciones → Webhooks). Configura ahí la URL `https://TU-DOMINIO/api/mercadopago/webhook` con el evento **Pagos**.
   - `APP_URL` (opcional): URL pública de la app, p. ej. `https://fortia.vercel.app`. Si no se define se usa el dominio de la petición.
   - `SUPABASE_COACHING_BUCKET` (opcional, por defecto `coaching`): bucket público para fotos, adjuntos y documentos. Se crea automáticamente si no existe.
4. Crear el acceso de cada cliente en *Coaching → Clientes → (cliente) → Ajustes → Acceso a la app*. El cliente entra por `/login` y va directo a su app; puede “Añadir a pantalla de inicio” en el celular.

### Desarrollo
```bash
npm install
npm run dev
```
