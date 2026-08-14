-- CreateEnum
CREATE TYPE "ExamPrepItemKind" AS ENUM ('CONTENT', 'OBJECTIVE');

-- CreateEnum
CREATE TYPE "ExamPrepItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "decks" ADD COLUMN     "examPrepId" TEXT;

-- AlterTable
ALTER TABLE "study_sessions" ADD COLUMN     "examPrepId" TEXT;

-- CreateTable
CREATE TABLE "exam_preps" (
    "id" TEXT NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,

    CONSTRAINT "exam_preps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_prep_items" (
    "id" TEXT NOT NULL,
    "kind" "ExamPrepItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ExamPrepItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "examPrepId" TEXT NOT NULL,

    CONSTRAINT "exam_prep_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_prep_materials" (
    "id" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examPrepId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    CONSTRAINT "exam_prep_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_preps_examId_key" ON "exam_preps"("examId");

-- CreateIndex
CREATE INDEX "exam_preps_userId_idx" ON "exam_preps"("userId");

-- CreateIndex
CREATE INDEX "exam_prep_items_examPrepId_kind_idx" ON "exam_prep_items"("examPrepId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "exam_prep_materials_examPrepId_attachmentId_key" ON "exam_prep_materials"("examPrepId", "attachmentId");

-- CreateIndex
CREATE INDEX "decks_examPrepId_idx" ON "decks"("examPrepId");

-- CreateIndex
CREATE INDEX "study_sessions_examPrepId_idx" ON "study_sessions"("examPrepId");

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_examPrepId_fkey" FOREIGN KEY ("examPrepId") REFERENCES "exam_preps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_examPrepId_fkey" FOREIGN KEY ("examPrepId") REFERENCES "exam_preps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_preps" ADD CONSTRAINT "exam_preps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_preps" ADD CONSTRAINT "exam_preps_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_prep_items" ADD CONSTRAINT "exam_prep_items_examPrepId_fkey" FOREIGN KEY ("examPrepId") REFERENCES "exam_preps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_prep_materials" ADD CONSTRAINT "exam_prep_materials_examPrepId_fkey" FOREIGN KEY ("examPrepId") REFERENCES "exam_preps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_prep_materials" ADD CONSTRAINT "exam_prep_materials_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
