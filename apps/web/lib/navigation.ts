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
  Plug,
  type LucideIcon,
} from 'lucide-react';

/**
 * Estrutura de navegacao da aplicacao.
 *
 * Definida uma unica vez e consumida pela sidebar (desktop e mobile) e pelos
 * breadcrumbs. `stage` marca as telas ainda por construir, exibidas como
 * desabilitadas em vez de levarem a uma pagina inexistente.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Etapa do roadmap em que a tela e entregue. */
  stage?: number;
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
      { href: '/disciplinas', label: 'Disciplinas', icon: GraduationCap },
      { href: '/atividades', label: 'Atividades', icon: ListChecks },
      { href: '/provas', label: 'Provas', icon: ClipboardList },
      { href: '/notas', label: 'Notas', icon: BookOpen },
      { href: '/calendario', label: 'Calendário', icon: CalendarDays },
    ],
  },
  {
    title: 'Acompanhamento',
    items: [
      { href: '/historico', label: 'Histórico', icon: History },
      { href: '/estatisticas', label: 'Estatísticas', icon: ChartColumn },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/integracoes', label: 'Integrações', icon: Plug }],
  },
  {
    title: 'Estudos',
    items: [
      { href: '/materiais', label: 'Materiais', icon: FileStack },
      // Flashcards temporariamente fora da nav - visual atual nao ficou bom,
      // sera refeita antes de voltar. Rotas/paginas seguem intactas.
      { href: '/cronograma', label: 'Cronograma', icon: CalendarDays },
    ],
  },
];

/** Rotulo da rota atual, usado pelos breadcrumbs. */
export function findNavItem(pathname: string): NavItem | null {
  for (const section of NAV_SECTIONS) {
    const match = section.items.find(
      (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
    );

    if (match) return match;
  }

  return null;
}
