-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "promiseDate" TIMESTAMP(3),
    "createdByName" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "FollowUp_at_idx" ON "FollowUp"("at");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_clientId_kind_step_cycleKey_key" ON "FollowUp"("clientId", "kind", "step", "cycleKey");

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

