CREATE TABLE "RenewalProjectionSkip" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RenewalProjectionSkip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RenewalProjectionSkip_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RenewalProjectionSkip_clientId_yearMonth_key"
  ON "RenewalProjectionSkip"("clientId", "yearMonth");
