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

/**
 * Decide se um refresh token já revogado que reaparece é retry legítimo ou
 * reuso (roubo).
 *
 * A janela de 30s sozinha não cobre o caso mais comum no celular: o app é
 * suspenso no meio da rotação, a resposta com o cookie novo nunca chega, e o
 * token antigo só volta horas depois - fora da janela, derrubando TODOS os
 * dispositivos. O sinal que separa os dois casos é o sucessor: se o token
 * emitido no lugar deste nunca foi apresentado, quem tem o token antigo é o
 * próprio dono que perdeu a resposta. Um atacante só é detectável quando um
 * dos dois lados já seguiu a cadeia - e aí o sucessor aparece como usado.
 */
export function isLegitimateRetry(input: {
  revokedAt: Date;
  now: Date;
  graceMs: number;
  /** `null` quando não há sucessor registrado (token anterior a esta regra). */
  successorUsed: boolean | null;
}): boolean {
  if (isWithinReuseGrace(input.revokedAt, input.now, input.graceMs)) return true;

  return input.successorUsed === false;
}
