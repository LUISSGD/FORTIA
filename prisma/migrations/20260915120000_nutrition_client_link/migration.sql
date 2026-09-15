ALTER TABLE "NutritionClient"
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD CONSTRAINT "NutritionClient_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "NutritionClient_clientId_idx" ON "NutritionClient"("clientId");
