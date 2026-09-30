import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { getLatestWeight, getNutritionDay, getTrainingState } from "@/lib/coaching/client-data"
import { challengeProgress, clientAchievements } from "@/lib/coaching/stats"
import { dateTimeLima, todayYmd, weekdayYmd, weekStartYmd } from "@/lib/coaching/dates"
import { fmtKg } from "@/lib/coaching/workout"
import { Bar, CTA, Card, SectionTitle } from "@/components/coaching/app/ui"
import WaterWidget from "@/components/coaching/app/WaterWidget"
import PushToggle from "@/components/coaching/PushToggle"
import PtCheckIn from "@/components/coaching/app/PtCheckIn"
import MembershipCard from "@/components/coaching/app/MembershipCard"
import { getMembership, getPersonalTraining } from "@/lib/coaching/personal-training"

export default async function ClientHome() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { clientId } = ctx
  const today = todayYmd()

  const [client, training, nutrition, weight, checkIn, nextBooking, challenge, { streak }, membership, pt] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, coachingProfile: true } }),
    getTrainingState(clientId),
    getNutritionDay(clientId),
    getLatestWeight(clientId),
    prisma.checkIn.findUnique({ where: { clientId_weekStart: { clientId, weekStart: weekStartYmd(today) } } }),
    prisma.coachingBooking.findFirst({ where: { clientId, status: "BOOKED", slot: { startsAt: { gte: new Date() } } }, include: { slot: true }, orderBy: { slot: { startsAt: "asc" } } }),
    prisma.challenge.findFirst({ where: { isActive: true, startDate: { lte: today }, endDate: { gte: today } }, orderBy: { startDate: "desc" } }),
    clientAchievements(clientId),
    getMembership(clientId),
    getPersonalTraining(clientId),
  ])
  const profile = client?.coachingProfile
  const challengeValue = challenge ? (await challengeProgress(challenge, [clientId])).get(clientId) ?? 0 : 0
  const { program, nextDay, doneToday, week, dayIndex, weekWorkouts } = training
  const showCheckIn = !checkIn && weekdayYmd(today) >= 4
  const diff = weight.current !== null && weight.start !== null ? weight.current - weight.start : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Hola, {client?.firstName}</h1>
        <p className="text-sm text-zinc-400 mt-1">Tu objetivo no es simplemente entrenar. Es construir un físico fuerte, funcional y sostenible.</p>
      </div>

      {profile?.goal && (
        <Card className="bg-gradient-to-br from-orange-500/20 to-zinc-900 border-orange-500/30">
          <p className="text-[11px] uppercase tracking-widest text-orange-400 font-bold">Tu objetivo</p>
          <p className="text-lg font-bold mt-0.5">{profile.goal}</p>
          {profile.targetWeight && weight.current && (
            <p className="text-xs text-zinc-400 mt-1">Meta: {profile.targetWeight} kg · te faltan {fmtKg(Math.abs(weight.current - profile.targetWeight))} kg</p>
          )}
          {streak > 0 && <p className="text-xs text-orange-300 mt-2">Racha activa: {streak} día{streak === 1 ? "" : "s"}</p>}
        </Card>
      )}

      <PushToggle dark variant="banner" />

      {showCheckIn && (
        <Card href="/app/checkin" className="border-amber-500/40 bg-amber-500/10">
          <p className="font-bold">Check-in semanal pendiente</p>
          <p className="text-xs text-zinc-400">2 minutos para contarle a tu coach cómo te fue esta semana →</p>
        </Card>
      )}

      {pt && (
        <Card>
          <SectionTitle action={<span className="text-[11px] text-zinc-500">Personalizado</span>}>Mis clases</SectionTitle>
          <PtCheckIn initial={pt} compact />
        </Card>
      )}

      {membership && membership.state !== "none" && <MembershipCard m={membership} href="/app/personal" />}

      <Card>
        <SectionTitle action={<span className="text-[11px] text-zinc-500">{weekWorkouts}/{profile?.trainingDays ?? 4} esta semana</span>}>Entrenamiento de hoy</SectionTitle>
        {!program ? (
          <p className="text-sm text-zinc-400">Tu coach está preparando tu programa. ¡Pronto lo verás aquí!</p>
        ) : doneToday ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="font-bold text-emerald-400">✅ {doneToday.dayName} completado</p>
              <p className="text-xs text-zinc-400">{doneToday.durationMin} min · {doneToday.volumeKg.toLocaleString("es-PE")} kg de volumen</p>
            </div>
            {nextDay && <Link href={`/app/workout/${nextDay.id}`} className="block text-center text-xs text-zinc-500">Siguiente: {nextDay.name} →</Link>}
          </div>
        ) : nextDay ? (
          <div className="space-y-3">
            <div>
              <p className="text-xl font-black">{nextDay.name}</p>
              <p className="text-xs text-zinc-400">Semana {week} / Día {dayIndex} · {nextDay.exercises.length} ejercicios</p>
            </div>
            <CTA href={`/app/workout/${nextDay.id}`}>EMPEZAR</CTA>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Tu programa aún no tiene días.</p>
        )}
      </Card>

      <Card>
        <SectionTitle action={<Link href="/app/nutrition" className="text-xs text-zinc-400 font-medium">VER PLAN →</Link>}>Nutrición</SectionTitle>
        <p className="text-3xl font-black">
          {nutrition.consumed.kcal.toLocaleString("es-PE")} <span className="text-base font-medium text-zinc-500">/ {nutrition.targets.kcal.toLocaleString("es-PE")} kcal</span>
        </p>
        <Bar value={nutrition.consumed.kcal} max={nutrition.targets.kcal} className="mt-2" />
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          {([["Proteína", "protein", "bg-rose-500"], ["Carbos", "carbs", "bg-amber-400"], ["Grasas", "fat", "bg-violet-500"]] as const).map(([label, k, color]) => (
            <div key={k}>
              <p className="text-zinc-400">{label}</p>
              <p className="font-bold">{nutrition.consumed[k]}<span className="text-zinc-500 font-normal">/{nutrition.targets[k]} g</span></p>
              <Bar value={nutrition.consumed[k]} max={nutrition.targets[k]} className="h-1 mt-1" color={color} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Agua</SectionTitle>
        <WaterWidget initialMl={nutrition.waterMl} targetMl={nutrition.waterTargetMl} />
      </Card>

      <Card>
        <SectionTitle action={<Link href="/app/progress" className="text-xs text-zinc-400 font-medium">VER EVOLUCIÓN →</Link>}>Tu progreso</SectionTitle>
        {weight.current ? (
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black">{fmtKg(weight.current)} <span className="text-base font-medium text-zinc-500">kg</span></p>
            {diff !== null && diff !== 0 && (
              <p className={`text-sm font-semibold pb-1 ${diff < 0 ? "text-emerald-400" : "text-orange-400"}`}>{diff < 0 ? "📉" : "📈"} {diff > 0 ? "+" : ""}{fmtKg(diff)} kg desde el inicio</p>
            )}
          </div>
        ) : (
          <Link href="/app/progress" className="text-sm text-zinc-400">Registra tu peso para empezar a ver tu evolución →</Link>
        )}
      </Card>

      {nextBooking && (
        <Card href="/app/bookings">
          <SectionTitle>Próxima sesión</SectionTitle>
          <p className="font-bold">{nextBooking.slot.title}</p>
          <p className="text-sm text-zinc-400">{dateTimeLima(nextBooking.slot.startsAt)} · {nextBooking.slot.mode === "ONLINE" ? "Online" : "Presencial"}</p>
        </Card>
      )}

      {challenge && (
        <Card href="/app/challenge">
          <SectionTitle>Reto del mes</SectionTitle>
          <p className="font-bold">{challenge.title}</p>
          <Bar value={challengeValue} max={challenge.target} className="mt-2 h-3" />
          <p className="text-xs text-zinc-400 mt-1">{challengeValue} / {challenge.target} · {Math.min(100, Math.round((challengeValue / challenge.target) * 100))}%</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card href="/app/bookings" className="text-center py-5"><p className="text-sm font-semibold">Reservar sesión</p></Card>
        <Card href="/app/checkin" className="text-center py-5"><p className="text-sm font-semibold">Check-in semanal</p></Card>
      </div>
    </div>
  )
}
