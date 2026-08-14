import { redirect } from 'next/navigation';

/**
 * `/integracoes` deixou de existir como rota própria (Etapa 29.5) - o
 * conteúdo dobrou pra dentro de Configurações. Redirect, não 404, para quem
 * tiver a URL antiga salva em favoritos.
 */
export default function IntegracoesRedirectPage(): never {
  redirect('/configuracoes?tab=integracoes');
}
