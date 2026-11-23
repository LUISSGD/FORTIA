-- CreateTable
CREATE TABLE "StaffAccess" (
    "userId" TEXT NOT NULL,
    "modules" TEXT NOT NULL,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAccess_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

