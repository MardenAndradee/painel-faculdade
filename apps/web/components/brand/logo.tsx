import { cn } from '@/lib/utils';

/**
 * Marca do Painel Faculdade.
 *
 * Vetor inline, e nao arquivo de imagem: a logo aparece em tamanhos que vao de
 * 28px (sidebar) a 56px (login) e precisa acompanhar o tema claro/escuro. Como
 * SVG no DOM ela escala sem perda e troca de cor pelos tokens `--brand-*`
 * definidos em `globals.css`, sem duas versoes do mesmo arquivo nem troca de
 * `src` na hidratacao.
 *
 * As cores da marca sao tokens PROPRIOS, separados dos de UI: a logo precisa
 * ser a mesma cor onde quer que apareca, e amarra-la a `--primary` faria a
 * marca mudar junto com um ajuste de tema.
 */

interface LogoMarkProps {
  className?: string;
  /**
   * Decorativo: o nome ja aparece como texto ao lado.
   *
   * Sem isso, o lockup completo seria anunciado duas vezes pelo leitor de
   * tela - uma pelo `aria-label` do simbolo, outra pelo texto.
   */
  decorative?: boolean;
}

/**
 * Simbolo isolado - o "P" em bloco.
 *
 * Usado sozinho no favicon, no icone do app e onde nao ha espaco para o
 * nome por extenso.
 */
export function LogoMark({ className, decorative = false }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('size-8', className)}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': 'Painel Faculdade' })}
    >
      <rect
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        rx="23"
        className="fill-brand-mark-surface stroke-brand-mark-border"
        strokeWidth="1.5"
      />

      {/* Haste vertical do P. */}
      <rect x="23" y="23" width="14" height="54" rx="7" className="fill-brand-mark-bar" />

      {/* Barriga superior, cheia. */}
      <path
        d="M 41 23 H 72 C 76.5 23 80 26.5 80 31 V 41 C 80 45.5 76.5 49 72 49 H 41 V 23 Z"
        className="fill-brand-mark-block"
      />

      {/* Painel inferior, vazado - a metade "painel" do nome. */}
      <path
        d="M 41 55 H 66 C 70 55 73 58 73 62 V 70 C 73 74 70 77 66 77 H 41 V 55 Z"
        className="fill-brand-mark-panel stroke-brand-mark-border"
        strokeWidth="1"
      />

      <circle cx="57" cy="66" r="3.5" className="fill-brand-mark-dot" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Classe aplicada so ao simbolo, para ajustar o tamanho dele. */
  markClassName?: string;
  /** Some com o nome por extenso, deixando so o simbolo. */
  hideWordmark?: boolean;
}

/**
 * Lockup horizontal: simbolo + nome.
 *
 * O nome e TEXTO de verdade, nao `<text>` dentro do SVG. Assim herda a Inter
 * carregada pelo `next/font` (dentro do SVG a familia teria de ser repetida a
 * mao, e o nome gerado pelo `next/font` e um hash), continua selecionavel e
 * legivel por leitor de tela, e reescala com a tipografia da pagina.
 */
export function Logo({ className, markClassName, hideWordmark = false }: LogoProps) {
  return (
    // O tamanho do texto fica no elemento externo, e nao no do nome: assim
    // `cn` deixa quem usa trocar por `text-xl` sem que a classe interna vença.
    <span className={cn('inline-flex items-center gap-2.5 text-[15px]', className)}>
      <LogoMark className={cn('size-7 shrink-0', markClassName)} decorative={!hideWordmark} />

      {!hideWordmark && (
        <span className="leading-none font-extrabold tracking-tight whitespace-nowrap">
          Painel <span className="font-normal text-brand-wordmark">Faculdade</span>
        </span>
      )}
    </span>
  );
}
