-- Objetivos deixaram de existir como conceito no Plano de Estudos: o próprio
-- item (não só o rótulo "kind") sai antes de a coluna ser removida.
DELETE FROM "exam_prep_items" WHERE "kind" = 'OBJECTIVE';

-- DropIndex
DROP INDEX "exam_prep_items_examPrepId_kind_idx";

-- AlterTable
ALTER TABLE "exam_prep_items" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "ExamPrepItemKind";

-- CreateIndex
CREATE INDEX "exam_prep_items_examPrepId_idx" ON "exam_prep_items"("examPrepId");
