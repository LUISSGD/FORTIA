-- Attendance: tracks per-day class attendance for enrolled clients
CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "attended" BOOLEAN NOT NULL DEFAULT false,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Attendance_slotId_clientId_date_key" ON "Attendance"("slotId", "clientId", "date");
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PhysicalRecord: client body measurements over time
CREATE TABLE "PhysicalRecord" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "weight" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "bodyFat" DOUBLE PRECISION,
  "chest" DOUBLE PRECISION,
  "waist" DOUBLE PRECISION,
  "hips" DOUBLE PRECISION,
  "arms" DOUBLE PRECISION,
  "legs" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhysicalRecord_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PhysicalRecord" ADD CONSTRAINT "PhysicalRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
