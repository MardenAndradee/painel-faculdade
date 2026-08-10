-- AlterTable
ALTER TABLE "grade_configurations" ADD COLUMN     "defaultForUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "grade_configurations_defaultForUserId_key" ON "grade_configurations"("defaultForUserId");

-- AddForeignKey
ALTER TABLE "grade_configurations" ADD CONSTRAINT "grade_configurations_defaultForUserId_fkey" FOREIGN KEY ("defaultForUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

