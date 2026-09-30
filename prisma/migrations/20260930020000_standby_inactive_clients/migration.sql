-- Clientes dados de baja en FORTIA que seguían activos en coaching → stand-by (ex cliente).
UPDATE "CoachingProfile" cp
SET "status" = 'STANDBY'
FROM "Client" c
WHERE c."id" = cp."clientId"
  AND c."isActive" = false
  AND cp."status" IN ('ACTIVE', 'PAUSED');

-- Clientes en stand-by en coaching → inactivos en FORTIA.
UPDATE "Client" c
SET "isActive" = false
FROM "CoachingProfile" cp
WHERE c."id" = cp."clientId"
  AND cp."status" = 'STANDBY'
  AND c."isActive" = true;
