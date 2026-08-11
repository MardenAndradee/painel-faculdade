import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <ThemeProvider>
          {/* QueryProvider por fora do Auth: os hooks de dados dependem dele. */}
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
