import { createSerwistRoute } from '@serwist/turbopack';

/**
 * Rota que serve o Service Worker compilado (Etapa 28.4).
 *
 * Convenção exigida pelo `@serwist/turbopack`: como o Turbopack não suporta
 * o plugin de webpack clássico do Serwist, o SW não é mais um arquivo
 * estático gerado em build - é compilado sob demanda (via esbuild) por este
 * Route Handler dinâmico, e servido em `/sw.js` (e `/sw.js.map`, o source
 * map). `dynamicParams: false` (dentro do objeto devolvido) garante que
 * QUALQUER outro caminho de um segmento só (`/xyz`) continue caindo no 404
 * normal do Next, em vez de passar por aqui - só os arquivos que o Serwist
 * realmente gera são válidos.
 *
 * A pasta se chama literalmente `[path]`: é a sintaxe de rota dinâmica do
 * App Router, não um nome a preencher.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'app/sw.ts',
    // A pagina /offline nao e um asset estatico em public/ (e uma rota
    // renderizada do App Router), entao precisa ser listada explicitamente
    // para o SW buscar e guardar no install. A revisao muda a cada build,
    // o suficiente para o Serwist saber que precisa buscar de novo.
    additionalPrecacheEntries: [{ url: '/offline', revision: String(Date.now()) }],
  },
);
