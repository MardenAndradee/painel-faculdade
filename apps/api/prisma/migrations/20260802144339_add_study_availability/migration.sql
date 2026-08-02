-- CreateTable
CREATE TABLE "study_availability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "study_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_availability_userId_dayOfWeek_idx" ON "study_availability"("userId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "study_availability" ADD CONSTRAINT "study_availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
