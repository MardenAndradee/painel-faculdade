import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileStack,
  GraduationCap,
  History,
  Layers,
  ListChecks,
  NotebookPen,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AppModule } from '@painel/shared';

/**
 * Registro de Módulos Configuráveis (Etapa 29).
 *
 * Rótulo, descrição, ícone e rota moram só aqui - o backend nunca precisa
 * deles (só das chaves `AppModule` e das regras de dependência, ambas em
 * `@painel/shared`). Mesma separação que `navigation.ts` já tem em relação
 * às rotas. Ver docs/planning/modulos-configuraveis.md.
 */

export interface ModuleDefinition {
  module: AppModule;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Rota principal, usada pela guarda de rota central (Etapa 29.7). */
  route: string;
  /**
   * Falso para módulos sem item próprio na Sidebar - hoje `EXAM_PREP`
   * (alcançado de dentro de uma prova) e `FLASHCARDS` (fora da nav por
   * decisão anterior, redesenho pendente).
   */
  hasOwnSidebarEntry: boolean;
}

export const MODULE_DEFINITIONS: Record<AppModule, ModuleDefinition> = {
  SUBJECTS: {
    module: 'SUBJECTS',
    label: 'Disciplinas',
    description: 'Organize suas disciplinas e acompanhe seu semestre.',
    icon: GraduationCap,
    route: '/disciplinas',
    hasOwnSidebarEntry: true,
  },
  ASSIGNMENTS: {
    module: 'ASSIGNMENTS',
    label: 'Atividades',
    description: 'Controle suas atividades e prazos de entrega.',
    icon: ListChecks,
    route: '/atividades',
    hasOwnSidebarEntry: true,
  },
  EXAMS: {
    module: 'EXAMS',
    label: 'Provas',
    description: 'Acompanhe suas provas e prepare-se com antecedência.',
    icon: ClipboardList,
    route: '/provas',
    hasOwnSidebarEntry: true,
  },
  CALENDAR: {
    module: 'CALENDAR',
    label: 'Calendário',
    description: 'Veja prazos, provas e eventos em um só lugar.',
    icon: CalendarDays,
    route: '/calendario',
    hasOwnSidebarEntry: true,
  },
  GRADES: {
    module: 'GRADES',
    label: 'Notas',
    description: 'Acompanhe suas notas e médias.',
    icon: BookOpen,
    route: '/notas',
    hasOwnSidebarEntry: true,
  },
  HISTORY: {
    module: 'HISTORY',
    label: 'Histórico',
    description: 'Veja o histórico de semestres já cursados.',
    icon: History,
    route: '/historico',
    hasOwnSidebarEntry: true,
  },
  MATERIALS: {
    module: 'MATERIALS',
    label: 'Materiais',
    description: 'Organize seus arquivos e materiais acadêmicos.',
    icon: FileStack,
    route: '/materiais',
    hasOwnSidebarEntry: true,
  },
  FLASHCARDS: {
    module: 'FLASHCARDS',
    label: 'Flashcards',
    description: 'Memorize conteúdo com repetição espaçada.',
    icon: Layers,
    route: '/flashcards',
    hasOwnSidebarEntry: false,
  },
  STUDY_PLAN: {
    module: 'STUDY_PLAN',
    label: 'Cronograma',
    description: 'Organize suas sessões de estudo.',
    icon: CalendarDays,
    route: '/cronograma',
    hasOwnSidebarEntry: true,
  },
  EXAM_PREP: {
    module: 'EXAM_PREP',
    label: 'Plano de Estudos',
    description: 'Prepare-se para uma prova com conteúdos, materiais e flashcards reunidos.',
    icon: NotebookPen,
    route: '/plano-de-estudos',
    hasOwnSidebarEntry: false,
  },
  STATISTICS: {
    module: 'STATISTICS',
    label: 'Estatísticas',
    description: 'Acompanhe seu progresso acadêmico.',
    icon: ChartColumn,
    route: '/estatisticas',
    hasOwnSidebarEntry: true,
  },
  CLASSES: {
    module: 'CLASSES',
    label: 'Turmas',
    description: 'Compartilhe atividades, provas, eventos e materiais com colegas.',
    icon: Users,
    route: '/turmas',
    hasOwnSidebarEntry: true,
  },
};

/** Ordem de exibição em Configurações → Módulos - segue a ordem da Sidebar, com os dois módulos sem item próprio ao final. */
export const MODULE_DISPLAY_ORDER: AppModule[] = [
  'SUBJECTS',
  'ASSIGNMENTS',
  'EXAMS',
  'CALENDAR',
  'GRADES',
  'HISTORY',
  'MATERIALS',
  'STUDY_PLAN',
  'STATISTICS',
  'CLASSES',
  'EXAM_PREP',
  'FLASHCARDS',
];
