import { defineConfig } from 'vitest/config';

/**
 * Configuracao dos testes.
 *
 * O alvo sao as REGRAS PURAS: agendamento espacado, gerador de cronograma,
 * calculo de notas e os contratos Zod. Sao elas que concentram a logica de
 * negocio e, na pratica, foi nelas que os bugs apareceram durante o
 * desenvolvimento.
 *
 * Testes que exigem banco ficam fora daqui de proposito: eles precisam de um
 * Postgres dedicado com carga e limpeza a cada execucao, o que e uma decisao de
 * infraestrutura separada. O que existe hoje no lugar deles esta documentado no
 * README, em "Verificação".
 */
export default defineConfig({
  test: {
    include: ['{apps,packages}/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/generated/**'],
    environment: 'node',
    // O fuso e fixado porque varias regras dependem de "meia-noite local":
    // sem isso os testes passariam na maquina de quem escreveu e falhariam na
    // esteira, que costuma rodar em UTC.
    env: { TZ: 'America/Sao_Paulo' },
  },
});
