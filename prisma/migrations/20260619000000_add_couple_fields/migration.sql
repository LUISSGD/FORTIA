ALTER TABLE "Client" ADD COLUMN "firstName2" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastName2" TEXT;
ALTER TABLE "Client" ADD COLUMN "phone2" TEXT;
ALTER TABLE "Client" ADD COLUMN "dni2" TEXT;
CREATE UNIQUE INDEX "Client_dni2_key" ON "Client"("dni2");
