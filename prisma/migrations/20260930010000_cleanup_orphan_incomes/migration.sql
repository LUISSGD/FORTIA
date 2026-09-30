-- Limpieza de datos: ingresos de membresía / entrenamiento personal cuyo pago del
-- cliente ya fue borrado (antes, borrar un pago podía dejar su ingreso en Finanzas).
-- Solo /api/payments crea ingresos de estas categorías con cliente; los ingresos
-- manuales de Finanzas no llevan cliente, así que no se tocan.
DELETE FROM "Income" i
WHERE i."clientId" IS NOT NULL
  AND i."category" IN ('MEMBERSHIP', 'PERSONAL_TRAINING')
  AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."incomeId" = i."id")
  AND NOT EXISTS (SELECT 1 FROM "CoachingPayment" cp WHERE cp."incomeId" = i."id")
  AND NOT EXISTS (SELECT 1 FROM "ClientTrainingPlan" tp WHERE tp."incomeId" = i."id");
