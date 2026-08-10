/*
  Warnings:

  - You are about to drop the column `type` on the `grades` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `grades` table. All the data in the column will be lost.
  - You are about to drop the column `passingGrade` on the `subjects` table. All the data in the column will be lost.
  - Added the required column `gradeComponentId` to the `grades` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "grades_subjectId_type_idx";

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "gradeComponentId" TEXT;

-- AlterTable
ALTER TABLE "grades" DROP COLUMN "type",
DROP COLUMN "weight",
ADD COLUMN     "gradeComponentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "passingGrade";

-- DropEnum
DROP TYPE "GradeType";

-- CreateTable
CREATE TABLE "grade_configurations" (
    "id" TEXT NOT NULL,
    "passingGrade" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "semesterId" TEXT,

    CONSTRAINT "grade_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeConfigurationId" TEXT NOT NULL,

    CONSTRAINT "grade_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grade_configurations_subjectId_key" ON "grade_configurations"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_configurations_semesterId_key" ON "grade_configurations"("semesterId");

-- CreateIndex
CREATE INDEX "grade_configurations_userId_idx" ON "grade_configurations"("userId");

-- CreateIndex
CREATE INDEX "grade_components_gradeConfigurationId_idx" ON "grade_components"("gradeConfigurationId");

-- CreateIndex
CREATE INDEX "exams_gradeComponentId_idx" ON "exams"("gradeComponentId");

-- CreateIndex
CREATE INDEX "grades_subjectId_gradeComponentId_idx" ON "grades"("subjectId", "gradeComponentId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_gradeComponentId_fkey" FOREIGN KEY ("gradeComponentId") REFERENCES "grade_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_gradeComponentId_fkey" FOREIGN KEY ("gradeComponentId") REFERENCES "grade_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_configurations" ADD CONSTRAINT "grade_configurations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_configurations" ADD CONSTRAINT "grade_configurations_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_configurations" ADD CONSTRAINT "grade_configurations_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_components" ADD CONSTRAINT "grade_components_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_components" ADD CONSTRAINT "grade_components_gradeConfigurationId_fkey" FOREIGN KEY ("gradeConfigurationId") REFERENCES "grade_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
