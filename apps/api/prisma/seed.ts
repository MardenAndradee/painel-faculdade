import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Seed de desenvolvimento.
 *
 * Idempotente: usa upsert com chaves estaveis, entao rodar varias vezes nao
 * duplica dados. As datas sao relativas a data de execucao para que o dashboard
 * sempre tenha atividades vencidas, de hoje e futuras - caso contrario o seed
 * envelheceria e as telas de "proximas atividades" ficariam vazias.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 24 * 60 * 60 * 1000;

/** Data deslocada em dias a partir de agora, com hora fixa para previsibilidade. */
function daysFromNow(days: number, hour = 23, minute = 59): Date {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Modelo padrao de notas (Etapa 17): N1/N2/N3, pesos 3/4/3, aprovacao 6.
 *
 * E o modelo real do usuario (ver o pedido original da Etapa 17) - o seed
 * padroniza nisso em vez de inventar outro exemplo, para o ambiente de
 * desenvolvimento já nascer testável com o cenário real.
 */
const STANDARD_GRADE_COMPONENTS = [
  { name: 'N1', weight: 3 },
  { name: 'N2', weight: 4 },
  { name: 'N3', weight: 3 },
];

/** Garante a configuracao de notas da disciplina, criando se ainda nao existir. */
async function ensureGradeConfiguration(
  userId: string,
  subjectId: string,
): Promise<Map<string, string>> {
  const existing = await prisma.gradeConfiguration.findFirst({
    where: { userId, subjectId },
    select: { components: { select: { id: true, name: true } } },
  });

  if (existing)
    return new Map(existing.components.map((component) => [component.name, component.id]));

  const created = await prisma.gradeConfiguration.create({
    data: {
      userId,
      subjectId,
      passingGrade: 6,
      components: {
        create: STANDARD_GRADE_COMPONENTS.map((component, index) => ({
          userId,
          name: component.name,
          weight: component.weight,
          order: index,
        })),
      },
    },
    select: { components: { select: { id: true, name: true } } },
  });

  return new Map(created.components.map((component) => [component.name, component.id]));
}

async function main(): Promise<void> {
  console.log('Iniciando seed...');

  // ---------------------------------------------------------------------------
  // Usuario de desenvolvimento
  // ---------------------------------------------------------------------------
  const user = await prisma.user.upsert({
    where: { email: 'estudante@painel.dev' },
    update: {},
    create: {
      email: 'estudante@painel.dev',
      name: 'Estudante de Desenvolvimento',
      avatarUrl: null,
      theme: 'SYSTEM',
      // Simula um cadastro por Google: e-mail ja verificado, como
      // `userRepository.createFromGoogle` faz de verdade (Etapa 26).
      emailVerifiedAt: new Date(),
    },
  });

  // A identidade do Google mora em AuthIdentity desde a Etapa 26, nao mais em
  // `User.googleId` (deprecado). Sem isso o usuario de seed nao teria como
  // "logar com Google" pelo fluxo novo, e a tela de Integracoes o mostraria
  // como desconectado.
  await prisma.authIdentity.upsert({
    where: {
      provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: 'dev-google-id-000001' },
    },
    update: {},
    create: { provider: 'GOOGLE', providerAccountId: 'dev-google-id-000001', userId: user.id },
  });

  console.log(`Usuario: ${user.email}`);

  // ---------------------------------------------------------------------------
  // Semestres: um encerrado (alimenta o Historico) e um em andamento
  // ---------------------------------------------------------------------------
  const now = new Date();
  const year = now.getFullYear();
  const currentTerm = now.getMonth() < 6 ? 1 : 2;
  const previousTerm = currentTerm === 1 ? 2 : 1;
  const previousYear = currentTerm === 1 ? year - 1 : year;

  const previousSemester = await prisma.semester.upsert({
    where: { userId_year_term: { userId: user.id, year: previousYear, term: previousTerm } },
    update: {},
    create: {
      userId: user.id,
      name: `${previousYear}.${previousTerm}`,
      year: previousYear,
      term: previousTerm,
      status: 'FINISHED',
      isCurrent: false,
      startDate: new Date(previousYear, previousTerm === 1 ? 1 : 7, 1),
      endDate: new Date(previousYear, previousTerm === 1 ? 5 : 11, 30),
    },
  });

  const currentSemester = await prisma.semester.upsert({
    where: { userId_year_term: { userId: user.id, year, term: currentTerm } },
    update: {},
    create: {
      userId: user.id,
      name: `${year}.${currentTerm}`,
      year,
      term: currentTerm,
      status: 'ACTIVE',
      isCurrent: true,
      startDate: new Date(year, currentTerm === 1 ? 1 : 7, 1),
      endDate: new Date(year, currentTerm === 1 ? 5 : 11, 30),
    },
  });

  console.log(`Semestres: ${previousSemester.name} (encerrado), ${currentSemester.name} (atual)`);

  // ---------------------------------------------------------------------------
  // Professores
  // ---------------------------------------------------------------------------
  const teachersData = [
    { key: 'seed-teacher-ana', name: 'Ana Beatriz Moreira', email: 'ana.moreira@universidade.edu' },
    {
      key: 'seed-teacher-carlos',
      name: 'Carlos Eduardo Lima',
      email: 'carlos.lima@universidade.edu',
    },
    {
      key: 'seed-teacher-fernanda',
      name: 'Fernanda Rocha',
      email: 'fernanda.rocha@universidade.edu',
    },
    { key: 'seed-teacher-joao', name: 'Joao Pedro Alves', email: 'joao.alves@universidade.edu' },
  ];

  const teachers = await Promise.all(
    teachersData.map((teacher) =>
      prisma.teacher.upsert({
        where: { userId_googleUserId: { userId: user.id, googleUserId: teacher.key } },
        update: {},
        create: {
          userId: user.id,
          name: teacher.name,
          email: teacher.email,
          googleUserId: teacher.key,
        },
      }),
    ),
  );

  console.log(`Professores: ${teachers.length}`);

  // ---------------------------------------------------------------------------
  // Disciplinas do semestre atual
  // ---------------------------------------------------------------------------
  const subjectsData = [
    {
      key: 'seed-course-algoritmos',
      name: 'Algoritmos e Estruturas de Dados',
      code: 'CC201',
      color: '#6366f1',
      room: 'Lab 04',
      credits: 4,
      teacherIndex: 0,
    },
    {
      key: 'seed-course-banco',
      name: 'Banco de Dados',
      code: 'CC302',
      color: '#10b981',
      room: 'Sala 12',
      credits: 4,
      teacherIndex: 1,
    },
    {
      key: 'seed-course-eng-software',
      name: 'Engenharia de Software',
      code: 'CC305',
      color: '#f59e0b',
      room: 'Sala 07',
      credits: 4,
      teacherIndex: 2,
    },
    {
      key: 'seed-course-redes',
      name: 'Redes de Computadores',
      code: 'CC308',
      color: '#ef4444',
      room: 'Lab 02',
      credits: 4,
      teacherIndex: 3,
    },
    {
      key: 'seed-course-calculo',
      name: 'Calculo III',
      code: 'MA203',
      color: '#8b5cf6',
      room: 'Sala 21',
      credits: 6,
      teacherIndex: 0,
    },
  ];

  const subjects = await Promise.all(
    subjectsData.map((subject) =>
      prisma.subject.upsert({
        where: { userId_googleCourseId: { userId: user.id, googleCourseId: subject.key } },
        update: {},
        create: {
          userId: user.id,
          semesterId: currentSemester.id,
          teacherId: teachers[subject.teacherIndex]?.id ?? null,
          name: subject.name,
          code: subject.code,
          color: subject.color,
          room: subject.room,
          credits: subject.credits,
          googleCourseId: subject.key,
          status: 'IN_PROGRESS',
        },
      }),
    ),
  );

  console.log(`Disciplinas (semestre atual): ${subjects.length}`);

  // Modelo padrao de notas do semestre atual: pre-preenche disciplinas novas
  // criadas manualmente durante o desenvolvimento (Etapa 17).
  await prisma.gradeConfiguration.upsert({
    where: { semesterId: currentSemester.id },
    update: {},
    create: {
      userId: user.id,
      semesterId: currentSemester.id,
      passingGrade: 6,
      components: {
        create: STANDARD_GRADE_COMPONENTS.map((component, index) => ({
          userId: user.id,
          name: component.name,
          weight: component.weight,
          order: index,
        })),
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Disciplinas do semestre anterior (Historico)
  // ---------------------------------------------------------------------------
  const historyData = [
    {
      key: 'seed-hist-poo',
      name: 'Programacao Orientada a Objetos',
      code: 'CC104',
      grade: 8.7,
      credits: 4,
    },
    { key: 'seed-hist-so', name: 'Sistemas Operacionais', code: 'CC205', grade: 7.4, credits: 4 },
    {
      key: 'seed-hist-estatistica',
      name: 'Estatistica Aplicada',
      code: 'MA110',
      grade: 5.2,
      credits: 2,
    },
  ];

  const historySubjects = await Promise.all(
    historyData.map((subject) => {
      // O semestre anterior representa um periodo ja encerrado: o seed reafirma
      // a consolidacao para que rodar `db:seed` devolva o historico ao estado
      // esperado, mesmo depois de encerrar/reabrir semestres em desenvolvimento.
      const consolidated = {
        semesterId: previousSemester.id,
        credits: subject.credits,
        finalGrade: subject.grade,
        status: (subject.grade >= 6 ? 'APPROVED' : 'FAILED') as const,
      };

      return prisma.subject.upsert({
        where: { userId_googleCourseId: { userId: user.id, googleCourseId: subject.key } },
        update: consolidated,
        create: {
          userId: user.id,
          name: subject.name,
          code: subject.code,
          color: '#64748b',
          googleCourseId: subject.key,
          ...consolidated,
        },
      });
    }),
  );

  console.log(`Disciplinas (historico): ${historyData.length}`);

  // Toda disciplina precisa de uma configuracao de notas (Etapa 17) - o seed
  // usa o mesmo modelo padrao (N1/N2/N3) para as do semestre atual e as do
  // historico, e guarda os ids dos componentes para os lancamentos abaixo.
  const gradeComponentsBySubject = new Map<string, Map<string, string>>();

  for (const subject of [...subjects, ...historySubjects]) {
    gradeComponentsBySubject.set(subject.id, await ensureGradeConfiguration(user.id, subject.id));
  }

  // ---------------------------------------------------------------------------
  // Atividades: atrasadas, de hoje, desta semana e futuras
  // ---------------------------------------------------------------------------
  const [algoritmos, banco, engSoftware, redes, calculo] = subjects;

  const assignmentsData = [
    {
      key: 'seed-work-001',
      title: 'Implementar arvore AVL com balanceamento',
      description: 'Entregar codigo em C com testes unitarios e analise de complexidade.',
      subjectId: algoritmos?.id,
      dueDate: daysFromNow(-3),
      priority: 'HIGH' as const,
      status: 'PENDING' as const,
      source: 'GOOGLE_CLASSROOM' as const,
    },
    {
      key: 'seed-work-002',
      title: 'Lista de exercicios - Normalizacao ate 3FN',
      subjectId: banco?.id,
      dueDate: daysFromNow(-1),
      priority: 'MEDIUM' as const,
      status: 'PENDING' as const,
      source: 'GOOGLE_CLASSROOM' as const,
    },
    {
      key: 'seed-work-003',
      title: 'Diagrama de casos de uso do projeto',
      description: 'Modelar o sistema escolhido pelo grupo usando UML.',
      subjectId: engSoftware?.id,
      dueDate: daysFromNow(0, 23, 59),
      priority: 'URGENT' as const,
      status: 'IN_PROGRESS' as const,
      source: 'MANUAL' as const,
    },
    {
      key: 'seed-work-004',
      title: 'Configurar VLANs no Packet Tracer',
      subjectId: redes?.id,
      dueDate: daysFromNow(2),
      priority: 'MEDIUM' as const,
      status: 'PENDING' as const,
      source: 'GOOGLE_CLASSROOM' as const,
    },
    {
      key: 'seed-work-005',
      title: 'Lista 7 - Integrais de superficie',
      subjectId: calculo?.id,
      dueDate: daysFromNow(5),
      priority: 'HIGH' as const,
      status: 'PENDING' as const,
      source: 'MANUAL' as const,
    },
    {
      key: 'seed-work-006',
      title: 'Relatorio de indices e planos de execucao',
      subjectId: banco?.id,
      dueDate: daysFromNow(9),
      priority: 'LOW' as const,
      status: 'PENDING' as const,
      source: 'MANUAL' as const,
    },
    {
      key: 'seed-work-007',
      title: 'Seminario sobre algoritmos gulosos',
      subjectId: algoritmos?.id,
      dueDate: daysFromNow(-10),
      priority: 'MEDIUM' as const,
      status: 'COMPLETED' as const,
      source: 'GOOGLE_CLASSROOM' as const,
      completedAt: daysFromNow(-11),
    },
    {
      key: 'seed-work-008',
      title: 'Documento de requisitos - versao 1',
      subjectId: engSoftware?.id,
      dueDate: daysFromNow(-18),
      priority: 'HIGH' as const,
      status: 'COMPLETED' as const,
      source: 'MANUAL' as const,
      completedAt: daysFromNow(-19),
    },
  ];

  for (const item of assignmentsData) {
    await prisma.assignment.upsert({
      where: { userId_googleCourseWorkId: { userId: user.id, googleCourseWorkId: item.key } },
      update: {},
      create: {
        userId: user.id,
        subjectId: item.subjectId ?? null,
        title: item.title,
        description: item.description ?? null,
        dueDate: item.dueDate,
        priority: item.priority,
        status: item.status,
        source: item.source,
        completedAt: item.completedAt ?? null,
        googleCourseWorkId: item.key,
        maxPoints: 10,
      },
    });
  }

  console.log(`Atividades: ${assignmentsData.length}`);

  // ---------------------------------------------------------------------------
  // Provas
  // ---------------------------------------------------------------------------
  const examsData = [
    {
      title: 'P1 - Complexidade e ordenacao',
      subjectId: algoritmos?.id,
      date: daysFromNow(6, 19, 0),
      content: 'Notacao assintotica, quicksort, mergesort, heapsort e arvores balanceadas.',
      component: 'N1',
      room: 'Sala 15',
      durationMinutes: 120,
    },
    {
      title: 'P1 - Modelagem relacional',
      subjectId: banco?.id,
      date: daysFromNow(12, 19, 0),
      content: 'Modelo ER, mapeamento relacional, normalizacao e algebra relacional.',
      component: 'N1',
      room: 'Sala 12',
      durationMinutes: 100,
    },
    {
      title: 'P1 - Camadas e protocolos',
      subjectId: redes?.id,
      date: daysFromNow(20, 21, 0),
      content: 'Modelo OSI, TCP/IP, enderecamento IPv4 e sub-redes.',
      component: 'N1',
      room: 'Lab 02',
      durationMinutes: 90,
    },
    {
      title: 'P1 - Series e integrais multiplas',
      subjectId: calculo?.id,
      date: daysFromNow(-14, 19, 0),
      content: 'Series de potencias, integrais duplas e triplas.',
      component: 'N1',
      room: 'Sala 21',
      durationMinutes: 120,
    },
  ];

  for (const item of examsData) {
    if (!item.subjectId) continue;

    const existing = await prisma.exam.findFirst({
      where: { userId: user.id, subjectId: item.subjectId, title: item.title },
    });

    if (existing) continue;

    await prisma.exam.create({
      data: {
        userId: user.id,
        subjectId: item.subjectId,
        title: item.title,
        date: item.date,
        content: item.content,
        // A prova nao guarda peso: ele vem do componente (Etapa 18).
        gradeComponentId: gradeComponentsBySubject.get(item.subjectId)?.get(item.component) ?? null,
        room: item.room,
        durationMinutes: item.durationMinutes,
      },
    });
  }

  console.log(`Provas: ${examsData.length}`);

  // ---------------------------------------------------------------------------
  // Notas ja lancadas
  // ---------------------------------------------------------------------------
  const gradesData = [
    { subjectId: calculo?.id, component: 'N1', value: 6.5 },
    { subjectId: algoritmos?.id, component: 'N1', value: 9, label: 'Seminario' },
    { subjectId: engSoftware?.id, component: 'N1', value: 8.5, label: 'Requisitos' },
    { subjectId: banco?.id, component: 'N1', value: 7, label: 'Lista 1' },
  ];

  for (const item of gradesData) {
    if (!item.subjectId) continue;

    const componentId = gradeComponentsBySubject.get(item.subjectId)?.get(item.component);

    if (!componentId) continue;

    const existing = await prisma.grade.findFirst({
      where: { userId: user.id, subjectId: item.subjectId, gradeComponentId: componentId },
    });

    if (existing) continue;

    await prisma.grade.create({
      data: {
        userId: user.id,
        subjectId: item.subjectId,
        gradeComponentId: componentId,
        label: item.label ?? null,
        value: item.value,
        maxValue: 10,
      },
    });
  }

  console.log(`Notas: ${gradesData.length}`);

  // ---------------------------------------------------------------------------
  // Eventos de calendario criados manualmente
  // ---------------------------------------------------------------------------
  const eventsData = [
    {
      title: 'Reuniao do grupo - projeto integrador',
      subjectId: engSoftware?.id,
      startsAt: daysFromNow(1, 18, 0),
      endsAt: daysFromNow(1, 19, 30),
      location: 'Biblioteca - sala de estudos 3',
    },
    {
      title: 'Monitoria de Calculo III',
      subjectId: calculo?.id,
      startsAt: daysFromNow(3, 17, 0),
      endsAt: daysFromNow(3, 18, 30),
      location: 'Sala 21',
    },
    {
      title: 'Semana academica de computacao',
      subjectId: null,
      startsAt: daysFromNow(15, 8, 0),
      endsAt: daysFromNow(17, 18, 0),
      location: 'Auditorio central',
    },
  ];

  for (const item of eventsData) {
    const existing = await prisma.calendarEvent.findFirst({
      where: { userId: user.id, title: item.title },
    });

    if (existing) continue;

    await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        subjectId: item.subjectId ?? null,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        location: item.location,
        source: 'MANUAL',
      },
    });
  }

  console.log(`Eventos: ${eventsData.length}`);

  // ---------------------------------------------------------------------------
  // Sessoes de estudo
  // ---------------------------------------------------------------------------
  const sessionsData = [
    {
      title: 'Revisar arvores balanceadas',
      subjectId: algoritmos?.id,
      scheduledStart: daysFromNow(1, 19, 0),
      scheduledEnd: daysFromNow(1, 21, 0),
      status: 'PLANNED' as const,
    },
    {
      title: 'Exercicios de normalizacao',
      subjectId: banco?.id,
      scheduledStart: daysFromNow(2, 20, 0),
      scheduledEnd: daysFromNow(2, 22, 0),
      status: 'PLANNED' as const,
    },
    {
      title: 'Revisao geral - integrais',
      subjectId: calculo?.id,
      scheduledStart: daysFromNow(-2, 19, 0),
      scheduledEnd: daysFromNow(-2, 21, 0),
      status: 'COMPLETED' as const,
      actualMinutes: 95,
    },
  ];

  for (const item of sessionsData) {
    const existing = await prisma.studySession.findFirst({
      where: { userId: user.id, title: item.title },
    });

    if (existing) continue;

    await prisma.studySession.create({
      data: {
        userId: user.id,
        subjectId: item.subjectId ?? null,
        title: item.title,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        status: item.status,
        actualMinutes: item.actualMinutes ?? null,
        autoGenerated: false,
      },
    });
  }

  console.log(`Sessoes de estudo: ${sessionsData.length}`);

  console.log('Seed concluido.');
}

main()
  .catch((error: unknown) => {
    console.error('Falha no seed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
