'use client';

import { use } from 'react';
import { StudySession } from '@/components/flashcards/study-session';

/** Estudo restrito a um baralho. */
export default function StudyDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <StudySession deckId={id} backHref={`/flashcards/${id}`} title="Revisão espaçada" />;
}
