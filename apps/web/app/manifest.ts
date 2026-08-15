import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (Etapa 28.2).
 *
 * Rota do App Router (`MetadataRoute.Manifest` tipado), no mesmo padrão de
 * `icon.svg`/`apple-icon.png` - convenção de arquivo, sem `<link>` manual.
 * Servido em `/manifest.webmanifest`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Painel Faculdade',
    // Rótulo embaixo do ícone na tela inicial - ~12 caracteres é o limite
    // prático antes de truncar na maioria dos launchers.
    short_name: 'Painel',
    description: 'Centralize atividades, provas, notas e materiais da faculdade em um único lugar.',
    // Quem instalou já tem sessão; cair na raiz e ser redirecionado ao login
    // piscaria a tela errada no primeiro frame.
    start_url: '/dashboard',
    display: 'standalone',
    // Fixos no escuro: o manifest é lido pelo sistema operacional na
    // instalação, não reage ao tema do app - um valor claro daria flash
    // branco ao abrir com o app no tema escuro.
    theme_color: '#0b0d12',
    background_color: '#0b0d12',
    orientation: 'portrait',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
