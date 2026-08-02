import type { NextConfig } from 'next';

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

export default nextConfig;
