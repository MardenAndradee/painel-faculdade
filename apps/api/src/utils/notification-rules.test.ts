import { describe, expect, it } from 'vitest';
import {
  planForAssignment,
  planForExam,
  planNotifications,
  type AssignmentSource,
  type ExamSource,
} from './notification-rules.js';

/**
 * Testes das regras de notificacao.
 *
 * O "agora" e injetado, entao "vence amanha" e exercitavel sem esperar o dia
 * virar nem mexer no relogio da maquina. Os testes rodam com
 * TZ=America/Sao_Paulo fixo (ver `vitest.config.ts`), o que importa aqui:
 * todas as comparacoes sao por dia de CALENDARIO local, nao por 24 horas
 * corridas.
 */

/** 10 de agosto de 2026, 14h - meio de um dia comum. */
const AGORA = new Date(2026, 7, 10, 14, 0);

/** Mesmo dia, hora diferente: precisa contar como "hoje", nao como "amanhã". */
function noDia(diasDepois: number, hora = 9): Date {
  return new Date(2026, 7, 10 + diasDepois, hora, 0);
}

function atividade(
  dueDate: Date | null,
  subjectName: string | null = 'Cálculo III',
): AssignmentSource {
  return { id: 'a1', title: 'Lista 3', dueDate, subjectName };
}

function prova(date: Date, subjectName: string | null = 'Redes'): ExamSource {
  return { id: 'e1', title: 'P1', date, subjectName };
}

describe('atividades', () => {
  it('não notifica atividade sem prazo', () => {
    // Tarefa pessoal sem data nao tem o que cobrar.
    expect(planForAssignment(atividade(null), AGORA)).toBeNull();
  });

  it('atrasada é urgente e diz há quantos dias', () => {
    const plan = planForAssignment(atividade(noDia(-3)), AGORA);

    expect(plan?.type).toBe('ASSIGNMENT_OVERDUE');
    expect(plan?.priority).toBe('URGENT');
    expect(plan?.message).toContain('Atrasada há 3 dias');
  });

  it('atrasada há um dia usa o singular', () => {
    expect(planForAssignment(atividade(noDia(-1)), AGORA)?.message).toContain('Atrasada há 1 dia');
  });

  it('para de cobrar depois de 30 dias', () => {
    // Passado disso o lembrete virou ruido - quem nao entregou ja sabe.
    expect(planForAssignment(atividade(noDia(-31)), AGORA)).toBeNull();
    expect(planForAssignment(atividade(noDia(-30)), AGORA)).not.toBeNull();
  });

  it('vence hoje é urgente, mesmo com o horário já passado', () => {
    // AGORA e 14h; um prazo das 9h do mesmo dia ainda e "hoje", nao "atrasada
    // ha 0 dias" - a comparacao e por dia de calendario.
    const plan = planForAssignment(atividade(noDia(0, 9)), AGORA);

    expect(plan?.type).toBe('ASSIGNMENT_DUE');
    expect(plan?.priority).toBe('URGENT');
    expect(plan?.message).toContain('Entrega hoje');
  });

  it('vence amanhã é atenção', () => {
    const plan = planForAssignment(atividade(noDia(1)), AGORA);

    expect(plan?.priority).toBe('ATTENTION');
    expect(plan?.message).toContain('Entrega amanhã');
  });

  it('vence em dois ou três dias é informativo', () => {
    expect(planForAssignment(atividade(noDia(2)), AGORA)?.priority).toBe('INFO');
    expect(planForAssignment(atividade(noDia(3)), AGORA)?.priority).toBe('INFO');
  });

  it('não notifica o que ainda está longe', () => {
    expect(planForAssignment(atividade(noDia(4)), AGORA)).toBeNull();
  });

  it('inclui a disciplina no contexto, quando existir', () => {
    expect(planForAssignment(atividade(noDia(0)), AGORA)?.message).toContain('Cálculo III');
    expect(planForAssignment(atividade(noDia(0), null), AGORA)?.message).toBe('Entrega hoje');
  });

  it('aponta para a atividade que a originou', () => {
    const plan = planForAssignment(atividade(noDia(0)), AGORA);

    expect(plan?.entityType).toBe('ASSIGNMENT');
    expect(plan?.entityId).toBe('a1');
  });
});

describe('provas', () => {
  it('não notifica prova que já aconteceu', () => {
    // O que resta de uma prova passada e a nota, nao um lembrete.
    expect(planForExam(prova(noDia(-1)), AGORA)).toBeNull();
  });

  it('hoje e amanhã são urgentes', () => {
    expect(planForExam(prova(noDia(0)), AGORA)?.priority).toBe('URGENT');
    expect(planForExam(prova(noDia(0)), AGORA)?.message).toBe('É hoje');
    expect(planForExam(prova(noDia(1)), AGORA)?.priority).toBe('URGENT');
    expect(planForExam(prova(noDia(1)), AGORA)?.message).toBe('É amanhã');
  });

  it('dois a três dias é atenção; quatro a sete é informativo', () => {
    expect(planForExam(prova(noDia(2)), AGORA)?.priority).toBe('ATTENTION');
    expect(planForExam(prova(noDia(3)), AGORA)?.priority).toBe('ATTENTION');
    expect(planForExam(prova(noDia(4)), AGORA)?.priority).toBe('INFO');
    expect(planForExam(prova(noDia(7)), AGORA)?.priority).toBe('INFO');
  });

  it('não entra no radar antes de uma semana', () => {
    expect(planForExam(prova(noDia(8)), AGORA)).toBeNull();
  });

  it('usa a disciplina no título, que é como a prova é reconhecida', () => {
    // O formulario nao coleta mais titulo de prova (ver `exam.ts`), entao
    // "P1" sozinho nao diria nada.
    expect(planForExam(prova(noDia(0)), AGORA)?.title).toBe('Prova de Redes');
    expect(planForExam(prova(noDia(0), null), AGORA)?.title).toBe('P1');
  });
});

describe('varredura completa', () => {
  it('junta as duas fontes e descarta o que não se aplica', () => {
    const plans = planNotifications(
      {
        assignments: [
          { id: 'a1', title: 'Lista 3', dueDate: noDia(0), subjectName: 'Cálculo III' },
          { id: 'a2', title: 'Longe', dueDate: noDia(20), subjectName: null },
          { id: 'a3', title: 'Sem prazo', dueDate: null, subjectName: null },
        ],
        exams: [
          { id: 'e1', title: 'P1', date: noDia(2), subjectName: 'Redes' },
          { id: 'e2', title: 'Passada', date: noDia(-5), subjectName: 'Banco' },
        ],
      },
      AGORA,
    );

    expect(plans.map((plan) => plan.entityId)).toEqual(['a1', 'e1']);
  });

  it('devolve lista vazia quando não há nada a avisar', () => {
    expect(planNotifications({ assignments: [], exams: [] }, AGORA)).toEqual([]);
  });
});

describe('escalonamento entre estados', () => {
  /**
   * A varredura decide criar, atualizar ou nao fazer nada comparando o plano
   * com a notificacao que ja existe (ver `notificationService.generatePending`).
   * Essa comparacao so funciona se estados diferentes produzirem conteudo
   * diferente - do contrario a atividade que passou de "amanha" para "hoje"
   * ficaria com o texto antigo; e, do outro lado, se o MESMO estado nao
   * produzisse conteudo identico, uma notificacao ja dispensada voltaria ao
   * sino a cada abertura.
   */
  const mesmaAtividade = (dias: number): AssignmentSource => ({
    id: 'a1',
    title: 'Lista 3',
    dueDate: noDia(dias),
    subjectName: 'Cálculo III',
  });

  it('cada estado gera mensagem e prioridade próprias', () => {
    const estados = [3, 1, 0, -1].map((dias) => planForAssignment(mesmaAtividade(dias), AGORA));
    const assinaturas = estados.map((plan) => `${plan?.priority}|${plan?.message}`);

    expect(new Set(assinaturas).size).toBe(estados.length);
  });

  it('o mesmo estado gera exatamente o mesmo conteúdo', () => {
    const primeira = planForAssignment(mesmaAtividade(1), AGORA);
    const segunda = planForAssignment(mesmaAtividade(1), new Date(2026, 7, 10, 22, 30));

    expect(primeira).toEqual(segunda);
  });

  it('vale também para provas', () => {
    const estados = [0, 1, 2, 5].map((dias) =>
      planForExam({ id: 'e1', title: 'P1', date: noDia(dias), subjectName: 'Redes' }, AGORA),
    );

    const assinaturas = estados.map((plan) => `${plan?.priority}|${plan?.message}`);

    expect(new Set(assinaturas).size).toBe(estados.length);
  });
});
