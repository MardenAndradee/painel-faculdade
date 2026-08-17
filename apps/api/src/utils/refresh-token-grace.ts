/**
 * Janela de tolerância na detecção de reuso do refresh token (Etapa 33).
 *
 * Função pura, com o "agora" injetado - mesmo padrão de
 * `notification-rules.ts`/`schedule-generator.ts` - pra dar pra testar a
 * borda exata da janela sem mexer no relógio da máquina.
 *
 * Ver docs/planning/refresh-token-grace-period.md para o racional completo:
 * em resumo, um token revogado reaparecer minutos/horas depois é sinal de
 * roubo, mas reaparecer poucos segundos depois da própria rotação é, na
 * prática, um retry legítimo (resposta perdida, app suspenso no meio da
 * renovação) - não vale derrubar todos os outros aparelhos por isso.
 */
export function isWithinReuseGrace(revokedAt: Date, now: Date, graceMs: number): boolean {
  return now.getTime() - revokedAt.getTime() <= graceMs;
}
