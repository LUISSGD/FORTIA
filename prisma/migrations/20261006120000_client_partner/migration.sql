-- Parejas con apps separadas: la ficha de la 2ª persona apunta a la ficha principal
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "partnerOfId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Client_partnerOfId_key" ON "Client"("partnerOfId");
DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_partnerOfId_fkey" FOREIGN KEY ("partnerOfId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
