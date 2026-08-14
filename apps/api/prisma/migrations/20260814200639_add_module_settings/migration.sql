-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('SUBJECTS', 'ASSIGNMENTS', 'EXAMS', 'CALENDAR', 'GRADES', 'HISTORY', 'MATERIALS', 'FLASHCARDS', 'STUDY_PLAN', 'EXAM_PREP', 'STATISTICS', 'CLASSES');

-- CreateTable
CREATE TABLE "user_module_settings" (
    "id" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "user_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_module_settings_userId_idx" ON "user_module_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_module_settings_userId_module_key" ON "user_module_settings"("userId", "module");

-- AddForeignKey
ALTER TABLE "user_module_settings" ADD CONSTRAINT "user_module_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
