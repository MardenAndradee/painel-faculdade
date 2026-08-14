import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileStack,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AppModule } from '@painel/shared';

/**
 * Estrutura de navegacao da aplicacao.
 *
 * Definida uma unica vez e consumida pela sidebar (desktop e mobile) e pelos
 * breadcrumbs. `stage` marca as telas ainda por construir, exibidas como
 * desabilitadas em vez de levarem a uma pagina inexistente. `module` liga o
 * item ao catalogo de Modulos Configuraveis (Etapa 29) - a Sidebar e a
 * guarda de rota central escondem/bloqueiam pelo mesmo campo, sem duplicar
 * o mapeamento rota->modulo em varios lugares.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Etapa do roadmap em que a tela e entregue. */
  stage?: number;
  /** Ausente = item estrutural, nunca escondido nem bloqueado. */
  module?: AppModule;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/turmas', label: 'Turmas', icon: Users, module: 'CLASSES' },
      { href: '/disciplinas', label: 'Disciplinas', icon: GraduationCap, module: 'SUBJECTS' },
      { href: '/atividades', label: 'Atividades', icon: ListChecks, module: 'ASSIGNMENTS' },
      { href: '/provas', label: 'Provas', icon: ClipboardList, module: 'EXAMS' },
      { href: '/notas', label: 'Notas', icon: BookOpen, module: 'GRADES' },
      { href: '/calendario', label: 'Calendário', icon: CalendarDays, module: 'CALENDAR' },
    ],
  },
  {
    title: 'Acompanhamento',
    items: [
      { href: '/historico', label: 'Histórico', icon: History, module: 'HISTORY' },
      { href: '/estatisticas', label: 'Estatísticas', icon: ChartColumn, module: 'STATISTICS' },
    ],
  },
  {
    title: 'Estudos',
    items: [
      { href: '/materiais', label: 'Materiais', icon: FileStack, module: 'MATERIALS' },
      // Flashcards fora da nav por padrao (FLASHCARDS nasce desativado) -
      // continua acessivel para quem ativa em Configuracoes -> Modulos.
      { href: '/cronograma', label: 'Cronograma', icon: CalendarDays, module: 'STUDY_PLAN' },
    ],
  },
];

/**
 * Itens estruturais - nunca escondidos por um modulo desativado, sempre
 * acessiveis. Renderizados separado do resto da Sidebar (§6 do plano).
 */
export const STRUCTURAL_NAV_ITEMS: NavItem[] = [
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

/** Rotulo da rota atual, usado pelos breadcrumbs. */
export function findNavItem(pathname: string): NavItem | null {
  for (const section of NAV_SECTIONS) {
    const match = section.items.find(
      (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
    );

    if (match) return match;
  }

  return (
    STRUCTURAL_NAV_ITEMS.find(
      (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
    ) ?? null
  );
}
