import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SerwistProvider } from '@serwist/turbopack/react';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { QueryPersistenceProvider } from '@/providers/query-persistence-provider';
import { ThemeSyncProvider } from '@/providers/theme-sync-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerUpdateToast } from '@/components/pwa/sw-update-toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Painel Faculdade',
    template: '%s | Painel Faculdade',
  },
  description: 'Centralize atividades, provas, notas e materiais da faculdade em um unico lugar.',
  // Instalação no iOS (Etapa 28.2): o Safari não lê o manifest para o modo
  // standalone - precisa desta chave própria. `black-translucent` deixa a
  // barra de status transparente sobre o app escuro, em vez de uma faixa
  // clara destoando do topo.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Painel',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sem isso, `env(safe-area-inset-*)` resolve como zero no iOS - qualquer
  // padding de area segura (Etapa 28.1/28.8) ficaria inerte.
  viewportFit: 'cover',
  // Cor da barra do navegador no celular: os mesmos `--background` de
  // `globals.css`. O valor escuro estava em `#09090b`, de antes da paleta
  // "Nocturne" - a barra destoava do topo da pagina por dois tons.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  // suppressHydrationWarning e necessario porque o next-themes ajusta a classe
  // do <html> antes da hidratacao, divergindo do HTML vindo do servidor.
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {/*
          Registra o Service Worker (Etapa 28.4). Desabilitado fora de
          producao pelo mesmo motivo do `next.config.ts`: um SW ativo durante
          o desenvolvimento intercepta fetch e atrapalha o hot reload,
          servindo bundle antigo do cache em vez do que acabou de ser salvo.
        */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== 'production'}>
          <ThemeProvider>
            {/* QueryProvider por fora do Auth: os hooks de dados dependem dele. */}
            <QueryProvider>
              <AuthProvider>
                <ThemeSyncProvider>
                  <QueryPersistenceProvider>{children}</QueryPersistenceProvider>
                </ThemeSyncProvider>
              </AuthProvider>
              <Toaster />
            </QueryProvider>
          </ThemeProvider>

          <ServiceWorkerUpdateToast />
        </SerwistProvider>
      </body>
    </html>
  );
}
