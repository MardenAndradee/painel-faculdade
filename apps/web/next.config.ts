import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Saida standalone: o Dockerfile de producao copia apenas o necessario.
  output: 'standalone',
  transpilePackages: ['@painel/shared'],
  images: {
    remotePatterns: [
      // Fotos de perfil do Google retornadas no login OAuth.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

// `withSerwist` so marca esbuild/esbuild-wasm como pacotes externos do
// servidor - a config de fato do Service Worker (Etapa 28.4) mora no Route
// Handler que serve `/sw.js`, em `app/[path]/route.ts`. Next 16 usa
// Turbopack por padrao em `next build`, e o plugin webpack classico do
// Serwist (`@serwist/next`) nao suporta Turbopack - por isso `@serwist/turbopack`,
// que compila o SW sob demanda via esbuild em vez de um plugin de webpack.
export default withSerwist(nextConfig);
