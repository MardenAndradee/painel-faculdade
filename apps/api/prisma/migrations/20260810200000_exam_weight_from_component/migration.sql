-- O peso da prova passa a morar no componente de avaliacao (Etapa 18).
--
-- `exams.weight` ja nao entrava em nenhuma media desde a Etapa 17 - quem pesa
-- e `grade_components.weight`. Manter a coluna so permitia que a prova ficasse
-- com um peso diferente do componente que ela representa.
--
-- Sem backfill: nao ha como traduzir o peso de uma prova em peso de componente
-- (varias provas podem apontar para o mesmo componente). O valor antigo e
-- descartado, e o peso exibido passa a ser o do componente.
ALTER TABLE "exams" DROP COLUMN "weight";
