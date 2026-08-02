'use client';

import { StudySession } from '@/components/flashcards/study-session';

/** Estudo misturando todos os baralhos. */
export default function StudyAllPage() {
  return <StudySession backHref="/flashcards" title="Revisão espaçada · todos os baralhos" />;
}
