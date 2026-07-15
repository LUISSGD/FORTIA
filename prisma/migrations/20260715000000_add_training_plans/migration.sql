CREATE TABLE "ClientTrainingPlan" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "modalidad" TEXT NOT NULL,
  "tipoEntrenador" TEXT NOT NULL,
  "tarifa" TEXT NOT NULL,
  "numPacks" INTEGER NOT NULL,
  "clasesPerPack" INTEGER NOT NULL,
  "pricePaid" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PEN',
  "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
  "currentPackStart" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "incomeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientTrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientTrainingPlan_incomeId_key" ON "ClientTrainingPlan"("incomeId");

CREATE TABLE "TrainingSession" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "sessionNumber" INTEGER NOT NULL,
  "packNumber" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientTrainingPlan" ADD CONSTRAINT "ClientTrainingPlan_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "ClientTrainingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
