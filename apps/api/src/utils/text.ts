/** Helpers de texto compartilhados pelos services. */

/**
 * Normaliza campo de texto opcional vindo de formulario.
 *
 * O HTML nao tem "campo ausente": um input vazio chega como string vazia, e
 * gravar `""` no banco cria um terceiro estado alem de "preenchido" e "nulo" -
 * que depois obriga toda consulta a testar os dois. Aqui o vazio vira nulo uma
 * vez so, na fronteira do service.
 */
export function emptyToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
