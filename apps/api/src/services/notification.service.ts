import {
  buildPaginationMeta,
  type NotificationEntityType,
  type NotificationItem,
  type NotificationQuery,
  type NotificationPriority,
  type NotificationType,
  type PaginatedResult,
  type UnreadCount,
} from '@painel/shared';
import {
  notificationRepository,
  type NotificationDraft,
  type NotificationRow,
} from '../repositories/notification.repository.js';
import { AppError } from '../utils/app-error.js';
import {
  planNotifications,
  SCAN_WINDOW,
  SCANNED_TYPES,
  type NotificationPlan,
} from '../utils/notification-rules.js';

/**
 * Regra de negocio da central de notificacoes (Etapa 19).
 *
 * As notificacoes de prazo sao geradas SOB DEMANDA, ao listar - nao ha worker
 * nem fila no projeto, e um cron seria infraestrutura nova para uma varredura
 * de milissegundos. Mesmo principio do `useAutoSync`: quem decide o que
 * precisa existir e o servidor, na hora em que alguem pergunta.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    priority: row.priority as NotificationPriority,
    title: row.title,
    message: row.message,
    entityType: row.entityType as NotificationEntityType | null,
    entityId: row.entityId,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDraft(plan: NotificationPlan): NotificationDraft {
  return {
    type: plan.type,
    priority: plan.priority,
    title: plan.title,
    message: plan.message,
    entityType: plan.entityType,
    entityId: plan.entityId,
  };
}

/** Nada mudou de fato - regravar so trocaria o `updatedAt` por nada. */
function matches(row: NotificationRow, draft: NotificationDraft): boolean {
  return (
    row.type === draft.type &&
    row.priority === draft.priority &&
    row.title === draft.title &&
    row.message === draft.message
  );
}

export const notificationService = {
  /**
   * Sincroniza as notificacoes de prazo com a realidade.
   *
   * Tres movimentos, nesta ordem:
   *
   * 1. o que deve existir e nao existe -> cria;
   * 2. o que existe e mudou de estado -> ATUALIZA a mesma linha (a atividade
   *    que ontem "vencia amanha" hoje "vence hoje" continua sendo uma
   *    notificacao so, nao duas);
   * 3. o que existe e nao deve mais existir -> apaga (atividade concluida,
   *    prova que passou).
   *
   * O passo 3 mexe apenas nos tipos que a varredura administra
   * (`SCANNED_TYPES`). Uma notificacao de "nova atividade do Classroom" tem
   * `entityType: ASSIGNMENT` igual as de prazo, e sem esse recorte seria
   * varrida junto por nao ter um plano correspondente.
   *
   * Notificacao ja lida nunca e tocada: e historico do que a pessoa viu.
   */
  async generatePending(userId: string, now = new Date()): Promise<void> {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const sources = await notificationRepository.findScanSources(userId, {
      assignmentsFrom: new Date(
        startOfToday.getTime() - SCAN_WINDOW.overdueAssignmentDays * MS_PER_DAY,
      ),
      assignmentsTo: new Date(
        startOfToday.getTime() + (SCAN_WINDOW.upcomingAssignmentDays + 1) * MS_PER_DAY,
      ),
      examsFrom: startOfToday,
      examsTo: new Date(startOfToday.getTime() + (SCAN_WINDOW.upcomingExamDays + 1) * MS_PER_DAY),
    });

    const plans = planNotifications(
      {
        assignments: sources.assignments.map((row) => ({
          id: row.id,
          title: row.title,
          dueDate: row.dueDate,
          subjectName: row.subject?.name ?? null,
        })),
        exams: sources.exams.map((row) => ({
          id: row.id,
          title: row.title,
          date: row.date,
          subjectName: row.subject?.name ?? null,
        })),
      },
      now,
    );

    const isScanned = (row: NotificationRow): boolean =>
      SCANNED_TYPES.includes(row.type as NotificationType);

    const [related, unreadAssignments, unreadExams] = await Promise.all([
      notificationRepository.findByEntityIds(
        userId,
        plans.map((plan) => plan.entityId),
      ),
      notificationRepository.findUnreadByEntityType(userId, 'ASSIGNMENT'),
      notificationRepository.findUnreadByEntityType(userId, 'EXAM'),
    ]);

    /**
     * A notificacao vigente de cada entidade.
     *
     * A nao lida tem precedencia; sem ela, vale a lida mais recente (a consulta
     * ja vem ordenada por `createdAt` desc). E a lida que impede a varredura de
     * ressuscitar o que a pessoa acabou de dispensar.
     */
    const currentByEntity = new Map<string, NotificationRow>();

    for (const row of related.filter(isScanned)) {
      const key = `${row.entityType}:${row.entityId}`;
      const previous = currentByEntity.get(key);

      if (!previous || (previous.readAt !== null && row.readAt === null)) {
        currentByEntity.set(key, row);
      }
    }

    for (const plan of plans) {
      const current = currentByEntity.get(`${plan.entityType}:${plan.entityId}`);
      const draft = toDraft(plan);

      if (!current) {
        await notificationRepository.create(userId, draft);
        continue;
      }

      if (current.readAt === null) {
        if (!matches(current, draft)) {
          await notificationRepository.update(userId, current.id, draft);
        }

        continue;
      }

      /**
       * Ja existe uma LIDA para esta entidade.
       *
       * Identica ao que a varredura produziria: a pessoa ja viu exatamente
       * isto e dispensou - nao ha o que avisar de novo.
       *
       * Diferente: o estado evoluiu ("vence amanha" virou "vence hoje", ou
       * "atrasada"). Isso merece um aviso novo, e nao reabrir o antigo, que
       * fica no historico do que ja foi lido.
       */
      if (!matches(current, draft)) {
        await notificationRepository.create(userId, draft);
      }
    }

    /**
     * Reconciliacao: o que nao tem mais motivo de existir sai.
     *
     * Atividade concluida, prova que passou. So mexe nas NAO LIDAS e nos tipos
     * que a varredura administra - notificacao lida e historico do que a pessoa
     * viu, e a de "nova atividade do Classroom" tem `entityType: ASSIGNMENT`
     * igual as de prazo, mas nao e gerada aqui.
     */
    const plannedKeys = new Set(plans.map((plan) => `${plan.entityType}:${plan.entityId}`));

    const orphans = [...unreadAssignments, ...unreadExams]
      .filter(isScanned)
      .filter((row) => !plannedKeys.has(`${row.entityType}:${row.entityId}`));

    await notificationRepository.deleteMany(
      userId,
      orphans.map((row) => row.id),
    );
  },

  /** Lista, gerando as pendentes antes de responder. */
  async list(userId: string, query: NotificationQuery): Promise<PaginatedResult<NotificationItem>> {
    await this.generatePending(userId);

    const { rows, total } = await notificationRepository.findPaginated(
      userId,
      query.unreadOnly,
      (query.page - 1) * query.perPage,
      query.perPage,
    );

    return {
      data: rows.map(toItem),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  /**
   * Contagem para o indicador do sino.
   *
   * Tambem roda a varredura: e a chamada que o cabecalho faz periodicamente,
   * entao e por ela que uma atividade que venceu enquanto o app estava aberto
   * aparece sem precisar recarregar a pagina.
   */
  async unreadCount(userId: string): Promise<UnreadCount> {
    await this.generatePending(userId);

    return { unread: await notificationRepository.countUnread(userId) };
  },

  async markAsRead(userId: string, id: string): Promise<NotificationItem> {
    const row = await notificationRepository.markAsRead(userId, id);

    if (!row) throw AppError.notFound('Notificação');

    return toItem(row);
  },

  async markAllAsRead(userId: string): Promise<{ read: number }> {
    return { read: await notificationRepository.markAllAsRead(userId) };
  },

  /**
   * Avisa que a sincronizacao do Classroom trouxe atividades novas.
   *
   * So o que veio de fora vira notificacao: quem cadastra uma atividade a mao
   * sabe que acabou de fazer isso, e avisa-lo seria ruido.
   *
   * Ate `INDIVIDUAL_LIMIT` atividades, uma notificacao por atividade - assim o
   * clique leva direto ao item. Acima disso vira um resumo: a primeira
   * sincronizacao importa o semestre inteiro, e quarenta linhas no sino sao
   * ruido, nao informacao.
   */
  async notifyCreatedAssignments(
    userId: string,
    assignments: Array<{ id: string; title: string; subjectName: string | null }>,
  ): Promise<void> {
    const INDIVIDUAL_LIMIT = 5;

    if (assignments.length === 0) return;

    if (assignments.length > INDIVIDUAL_LIMIT) {
      await notificationRepository.create(userId, {
        type: 'SYNC_COMPLETED',
        priority: 'INFO',
        title: `${assignments.length} atividades novas do Classroom`,
        message: 'Importadas na última sincronização',
        entityType: null,
        entityId: null,
      });

      return;
    }

    for (const assignment of assignments) {
      await notificationRepository.create(userId, {
        type: 'ASSIGNMENT_CREATED',
        priority: 'INFO',
        title: assignment.title,
        message: assignment.subjectName
          ? `Nova atividade do Classroom · ${assignment.subjectName}`
          : 'Nova atividade do Classroom',
        entityType: 'ASSIGNMENT',
        entityId: assignment.id,
      });
    }
  },
};
