-- Semestre automatico (Etapa 31).
--
-- `Semester` deixa de ser criado a mao: nasce sozinho, calculado pela data de
-- hoje. Duas consequencias no schema:
--
-- 1. `SemesterStatus.PLANNED` deixa de existir - sem criacao manual
--    antecipada, nao ha mais "semestre planejado que ainda nao comecou".
--    Backfill primeiro (enquanto a coluna ainda e o enum antigo), senao o
--    cast do passo seguinte falha para qualquer linha PLANNED existente.
-- 2. `isCurrent` deixa de ser gravado - "semestre atual" passa a ser sempre
--    o que bate com o calendario, calculado ao vivo (`isCurrentSemester` em
--    packages/shared). Sem backfill necessario: a plataforma ainda nao esta
--    em uso (docs/planning/semestre-automatico.md).

UPDATE "semesters" SET "status" = 'ACTIVE' WHERE "status" = 'PLANNED';

-- AlterEnum: remove PLANNED de SemesterStatus.
BEGIN;
CREATE TYPE "SemesterStatus_new" AS ENUM ('ACTIVE', 'FINISHED');
ALTER TABLE "semesters" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "semesters" ALTER COLUMN "status" TYPE "SemesterStatus_new" USING ("status"::text::"SemesterStatus_new");
ALTER TYPE "SemesterStatus" RENAME TO "SemesterStatus_old";
ALTER TYPE "SemesterStatus_new" RENAME TO "SemesterStatus";
DROP TYPE "SemesterStatus_old";
ALTER TABLE "semesters" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable: isCurrent nunca mais persistido.
DROP INDEX "semesters_userId_isCurrent_idx";
ALTER TABLE "semesters" DROP COLUMN "isCurrent";
