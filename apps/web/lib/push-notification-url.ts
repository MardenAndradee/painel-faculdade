/**
 * Para onde um clique numa notificação push leva (Etapa 28.11).
 *
 * Extraída do Service Worker pelo mesmo motivo de `sw-runtime-caching.ts`:
 * `app/sw.ts` roda em escopo de Worker e não é importável por um teste
 * comum; esta função é TypeScript puro, sem `self`.
 */
export function resolveNotificationUrl(entityType: string | null | undefined): string {
  switch (entityType) {
    case 'ASSIGNMENT':
      return '/atividades';
    case 'EXAM':
      return '/provas';
    default:
      return '/dashboard';
  }
}
