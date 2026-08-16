-- Turma referencia Semestre de verdade (Etapa 30.3).
--
-- `Class` deixa de guardar `year`/`term` soltos e passa a apontar para o
-- `Semester` PESSOAL do dono (o mesmo que `resolveMemberSemester` ja
-- resolvia toda vez, so que agora materializado). Ganha tambem `period`
-- (1-8, progresso no curso - conceito diferente do `term` do Semester).
-- `ClassSubject`/`ClassPost` ganham o mesmo `semesterId`, herdado da turma no
-- momento da criacao e IMUTAVEL depois (sustenta a aba Historico da turma,
-- Etapa 30.8: o ciclo antigo continua marcado com o semestre antigo mesmo
-- apos "Finalizar semestre" avancar `Class.semesterId`).
--
-- Sequencia: coluna nullable -> backfill -> NOT NULL, mesmo padrao de
-- 20260816120000_semester_automatic. O backfill de Semester (INSERT) e uma
-- rede de seguranca, nao o caminho comum: `class.service.create` ja chama
-- `resolveMemberSemester` para o dono ao criar a turma, entao o Semester
-- correspondente normalmente ja existe.

-- AlterTable: colunas novas, nullable por enquanto. `period` em ClassSubject/
-- ClassPost (alem de semesterId) e o que permite a aba Historico saber a que
-- periodo do curso um ciclo antigo pertencia - o Semester (ano/metade) sozinho
-- nao carrega essa informacao.
ALTER TABLE "classes" ADD COLUMN "semesterId" TEXT;
ALTER TABLE "classes" ADD COLUMN "period" INTEGER;
ALTER TABLE "class_subjects" ADD COLUMN "semesterId" TEXT;
ALTER TABLE "class_subjects" ADD COLUMN "period" INTEGER;
ALTER TABLE "class_posts" ADD COLUMN "semesterId" TEXT;
ALTER TABLE "class_posts" ADD COLUMN "period" INTEGER;

-- Backfill 1: cria o Semester do dono para (year, term) da turma, se por
-- algum motivo ainda nao existir. Sem copia de modelo de notas (`GradeConfiguration`
-- template) neste backfill puro-SQL - aceitavel porque a plataforma ainda nao
-- esta em uso (mesma razao usada no resto dos planos de Etapa 30/31); uma
-- disciplina nova cai no modelo pessoal padrao de qualquer jeito.
INSERT INTO "semesters" ("id", "name", "year", "term", "status", "startDate", "endDate", "createdAt", "updatedAt", "userId")
SELECT
  gen_random_uuid()::text,
  c."year" || '.' || c."term",
  c."year",
  c."term",
  'ACTIVE',
  CASE WHEN c."term" = 1 THEN make_date(c."year", 2, 1) ELSE make_date(c."year", 7, 16) END,
  CASE WHEN c."term" = 1 THEN make_date(c."year", 7, 15) ELSE make_date(c."year", 12, 20) END,
  now(),
  now(),
  c."ownerId"
FROM "classes" c
WHERE NOT EXISTS (
  SELECT 1 FROM "semesters" s
  WHERE s."userId" = c."ownerId" AND s."year" = c."year" AND s."term" = c."term"
)
GROUP BY c."ownerId", c."year", c."term"
ON CONFLICT ("userId", "year", "term") DO NOTHING;

-- Backfill 2: aponta cada turma para o Semester do dono. Periodo do curso
-- comeca em 1 para todo mundo - placeholder reconhecidamente errado para
-- quem ja esta em periodo avancado, corrigivel na tela de editar turma
-- (Etapa 30.7).
UPDATE "classes" c
SET "semesterId" = s."id", "period" = 1
FROM "semesters" s
WHERE s."userId" = c."ownerId" AND s."year" = c."year" AND s."term" = c."term";

-- Backfill 3: moldes e publicacoes herdam semestre e periodo da propria turma.
UPDATE "class_subjects" cs SET "semesterId" = c."semesterId", "period" = c."period" FROM "classes" c WHERE cs."classId" = c."id";
UPDATE "class_posts" cp SET "semesterId" = c."semesterId", "period" = c."period" FROM "classes" c WHERE cp."classId" = c."id";

-- Confere que ninguem ficou sem semestre antes de travar NOT NULL - se
-- divergir, a migracao inteira e revertida (mesma transacao).
DO $$
DECLARE
  classes_total integer;
  classes_done integer;
  subjects_total integer;
  subjects_done integer;
  posts_total integer;
  posts_done integer;
BEGIN
  SELECT count(*) INTO classes_total FROM "classes";
  SELECT count(*) INTO classes_done FROM "classes" WHERE "semesterId" IS NOT NULL AND "period" IS NOT NULL;
  SELECT count(*) INTO subjects_total FROM "class_subjects";
  SELECT count(*) INTO subjects_done FROM "class_subjects" WHERE "semesterId" IS NOT NULL AND "period" IS NOT NULL;
  SELECT count(*) INTO posts_total FROM "class_posts";
  SELECT count(*) INTO posts_done FROM "class_posts" WHERE "semesterId" IS NOT NULL AND "period" IS NOT NULL;

  IF classes_total <> classes_done THEN
    RAISE EXCEPTION 'Backfill de Class.semesterId/period divergiu: % turmas, % completas', classes_total, classes_done;
  END IF;
  IF subjects_total <> subjects_done THEN
    RAISE EXCEPTION 'Backfill de ClassSubject.semesterId/period divergiu: % moldes, % completos', subjects_total, subjects_done;
  END IF;
  IF posts_total <> posts_done THEN
    RAISE EXCEPTION 'Backfill de ClassPost.semesterId/period divergiu: % publicacoes, % completas', posts_total, posts_done;
  END IF;
END $$;

-- Trava NOT NULL agora que todo mundo esta preenchido.
ALTER TABLE "classes" ALTER COLUMN "semesterId" SET NOT NULL;
ALTER TABLE "classes" ALTER COLUMN "period" SET NOT NULL;
ALTER TABLE "class_subjects" ALTER COLUMN "semesterId" SET NOT NULL;
ALTER TABLE "class_subjects" ALTER COLUMN "period" SET NOT NULL;
ALTER TABLE "class_posts" ALTER COLUMN "semesterId" SET NOT NULL;
ALTER TABLE "class_posts" ALTER COLUMN "period" SET NOT NULL;

-- year/term somem de Class - o semestre de verdade e que manda agora.
ALTER TABLE "classes" DROP COLUMN "year";
ALTER TABLE "classes" DROP COLUMN "term";

-- CreateIndex
CREATE INDEX "classes_semesterId_idx" ON "classes"("semesterId");
CREATE INDEX "class_subjects_semesterId_idx" ON "class_subjects"("semesterId");
CREATE INDEX "class_posts_semesterId_idx" ON "class_posts"("semesterId");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_posts" ADD CONSTRAINT "class_posts_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
