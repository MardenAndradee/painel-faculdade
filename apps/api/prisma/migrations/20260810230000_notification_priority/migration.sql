-- Central de notificacoes (Etapa 19).
--
-- O modelo `Notification` ja existia no schema desde uma etapa anterior, sem
-- repositorio, servico, rota nem tela. Esta migracao e o que faltava para
-- coloca-lo em uso, e e inteiramente ADITIVA: nada e removido nem alterado,
-- entao roda em banco com dados sem risco.

-- Urgencia, separada do tipo: a mesma atividade vira ATTENTION quando vence
-- amanha e URGENT quando vence hoje, sem trocar de tipo.
CREATE TYPE "NotificationPriority" AS ENUM ('URGENT', 'ATTENTION', 'INFO', 'DONE');

ALTER TABLE "notifications"
  ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO';

-- Atividade nova vinda da sincronizacao do Classroom.
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_CREATED';

-- A varredura sob demanda busca por entidade para atualizar a notificacao
-- existente em vez de criar outra a cada abertura do sino.
CREATE INDEX "notifications_userId_entityType_entityId_idx"
  ON "notifications" ("userId", "entityType", "entityId");
