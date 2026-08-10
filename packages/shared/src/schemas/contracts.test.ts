import { describe, expect, it } from 'vitest';
import { booleanQueryParam } from '../common.js';
import { createSubjectSchema, updateSubjectSchema } from './subject.js';
import { createExamSchema, updateExamSchema } from './exam.js';
import { updateGradeSchema } from './grade.js';
import { updateAssignmentSchema } from './assignment.js';
import { createLinkAttachmentSchema } from './attachment.js';
import { saveAvailabilitySchema } from './study-plan.js';

/**
 * Testes dos contratos.
 *
 * Estes existem por causa de dois bugs reais, que passaram por todas as
 * verificacoes de status HTTP porque a API respondia 200 alegremente enquanto
 * corrompia dados. Sao os testes que mais pagaram a si mesmos no projeto.
 */

describe('PATCH não pode aplicar defaults (o bug mais grave do projeto)', () => {
  /**
   * `.partial()` torna os campos opcionais mas NAO remove os `.default()`.
   * Com isso, um PATCH que mudava so a sala de uma prova reescrevia o peso
   * dela para 1; um PATCH de rotulo de nota devolvia a escala de 100 para 10;
   * e um PATCH de titulo de atividade voltava uma tarefa concluida para
   * pendente. Dai o padrao `xBaseSchema`: os defaults so entram no schema de
   * CRIACAO.
   */

  it('atualização de disciplina não reintroduz cor nem situação', () => {
    const parsed = updateSubjectSchema.parse({ room: 'Lab 04' });

    expect(parsed).toEqual({ room: 'Lab 04' });
    expect(parsed).not.toHaveProperty('color');
    expect(parsed).not.toHaveProperty('status');
  });

  it('mas a criação de disciplina AINDA aplica os defaults', () => {
    const parsed = createSubjectSchema.parse({ name: 'Cálculo III' });

    expect(parsed.color).toBe('#6366f1');
    expect(parsed.status).toBe('IN_PROGRESS');
  });

  it('prova não carrega mais peso próprio', () => {
    // O caso original: um PATCH da sala zerava o peso da prova para 1,
    // alterando silenciosamente a media da disciplina. A Etapa 18 removeu a
    // causa - o peso passou a morar no componente, e a prova nao tem campo
    // de peso nenhum para reescrever.
    expect(updateExamSchema.parse({ room: 'Sala 12' })).not.toHaveProperty('weight');

    const created = createExamSchema.parse({
      title: 'P1',
      subjectId: 'abc',
      date: '2026-08-15T19:00',
    });

    expect(created).not.toHaveProperty('weight');
  });

  it('campo de nota vazio na prova não vira zero', () => {
    // Caso real: uma prova futura sem nota lançada ainda estava fechando a
    // média em 0 porque o input HTML vazio ('') virava 0 via z.coerce.
    const parsed = createExamSchema.parse({
      title: 'P2',
      subjectId: 'abc',
      date: '2026-09-14T19:00',
      gradeComponentId: 'comp-1',
      gradeValue: '',
    });

    expect(parsed.gradeValue).toBeNull();
  });

  it('atualização de nota não reescreve isFinal para true', () => {
    // isFinal (Etapa 18) tem default(true) no schema de criação - se ele
    // vazasse para o de edição, um PATCH que só muda o rótulo destravaria
    // silenciosamente um componente marcado como "ainda em aberto".
    const parsed = updateGradeSchema.parse({ label: 'Prova substitutiva' });

    expect(parsed).not.toHaveProperty('isFinal');
  });

  it('atualização de nota não reescreve a escala', () => {
    // Uma nota lancada em escala 100 voltava para 10 ao editar o rotulo,
    // dividindo o valor do aluno por dez.
    const parsed = updateGradeSchema.parse({ label: 'Prova substitutiva' });

    expect(parsed).not.toHaveProperty('maxValue');
  });

  it('atualização de atividade não reescreve prioridade nem situação', () => {
    // Este devolvia uma atividade CONCLUIDA para pendente.
    const parsed = updateAssignmentSchema.parse({ title: 'Lista 3 revisada' });

    expect(parsed).not.toHaveProperty('priority');
    expect(parsed).not.toHaveProperty('status');
  });
});

describe('booleanQueryParam', () => {
  /**
   * `z.coerce.boolean()` usa a conversao do JavaScript, e `Boolean("false")`
   * e `true`. Na pratica isso fazia `?permanent=false` APAGAR permanentemente
   * uma disciplina que deveria apenas ser arquivada.
   */
  const schema = booleanQueryParam(false);

  it('lê "false" como falso', () => {
    expect(schema.parse('false')).toBe(false);
  });

  it('lê "true" como verdadeiro', () => {
    expect(schema.parse('true')).toBe(true);
  });

  it('aceita "1" e "0"', () => {
    expect(schema.parse('1')).toBe(true);
    expect(schema.parse('0')).toBe(false);
  });

  it('usa o padrão quando ausente ou vazio', () => {
    expect(schema.parse(undefined)).toBe(false);
    expect(schema.parse('')).toBe(false);
    expect(booleanQueryParam(true).parse(undefined)).toBe(true);
  });

  it('preserva booleano já tipado', () => {
    expect(schema.parse(true)).toBe(true);
    expect(schema.parse(false)).toBe(false);
  });
});

describe('mensagens de validação em português', () => {
  it('reclama do campo ausente', () => {
    const result = createSubjectSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('Informe o nome');
  });

  it('reclama também do campo vazio vindo de formulário', () => {
    // O HTML envia string vazia, nao `undefined`: sem o `.min(1)` a mensagem
    // padrao em ingles do Zod vazava para a tela.
    const result = createSubjectSchema.safeParse({ name: '' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('nome');
    expect(JSON.stringify(result.error?.issues)).not.toContain('String must contain');
  });
});

describe('regras de segurança nos contratos', () => {
  it('recusa endereço que não seja http(s)', () => {
    // `javascript:` num href e execucao de script; barrar no contrato impede
    // que chegue ao banco.
    expect(
      createLinkAttachmentSchema.safeParse({ name: 'x', url: 'javascript:alert(1)' }).success,
    ).toBe(false);

    expect(createLinkAttachmentSchema.safeParse({ name: 'x', url: 'ftp://arquivo' }).success).toBe(
      false,
    );

    expect(
      createLinkAttachmentSchema.safeParse({ name: 'x', url: 'https://exemplo.com' }).success,
    ).toBe(true);
  });

  it('recusa janela de disponibilidade invertida', () => {
    const result = saveAvailabilitySchema.safeParse({
      windows: [{ dayOfWeek: 1, startMinute: 720, endMinute: 600 }],
    });

    expect(result.success).toBe(false);
  });

  it('recusa dia da semana fora de 0–6', () => {
    const result = saveAvailabilitySchema.safeParse({
      windows: [{ dayOfWeek: 9, startMinute: 600, endMinute: 720 }],
    });

    expect(result.success).toBe(false);
  });
});

describe('data digitada é a data salva (bug do dia anterior)', () => {
  /**
   * O JavaScript le "2026-10-05" como meia-noite UTC e "2026-10-05T00:00"
   * como meia-noite local. Com isso, uma prova cadastrada para 05/10 era
   * gravada as 00:00Z - 21h do dia 04 no horario de Brasilia - e aparecia no
   * calendario um dia antes. Os testes rodam com TZ=America/Sao_Paulo fixo.
   */

  it('prova cadastrada para 05/10 fica em 05/10', () => {
    const parsed = createExamSchema.parse({
      subjectId: 'abc',
      date: '2026-10-05',
    });

    expect(parsed.date.getFullYear()).toBe(2026);
    expect(parsed.date.getMonth()).toBe(9);
    expect(parsed.date.getDate()).toBe(5);
  });

  it('data com hora continua sendo lida como horário local', () => {
    const parsed = createExamSchema.parse({
      subjectId: 'abc',
      date: '2026-10-05T19:30',
    });

    expect(parsed.date.getDate()).toBe(5);
    expect(parsed.date.getHours()).toBe(19);
  });

  it('vale também para o prazo de uma atividade', () => {
    const parsed = updateAssignmentSchema.parse({ dueDate: '2026-10-05' });

    expect(parsed.dueDate?.getDate()).toBe(5);
  });
});
