'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Saudacao conforme a hora do dia.
 *
 * Calculada no cliente, com o relogio de quem esta lendo. Fazer isso no
 * servidor mostraria "Boa noite" para quem acessa de manha em outro fuso.
 *
 * Na primeira renderizacao usa uma saudacao neutra: o horario do servidor e do
 * navegador podem divergir, e isso quebraria a hidratacao.
 */
function getGreeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';

  return 'Boa noite';
}

/** "sexta-feira, 7 de agosto" -> "Sexta-feira, 7 de agosto". */
function formatTodayLabel(date: Date): string {
  const label = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface GreetingProps {
  name: string;
  semesterName: string | null;
  /** Entregas com prazo dentro dos proximos 7 dias. */
  dueThisWeekCount: number;
  /** Dias ate a proxima prova, ou nulo quando nao ha prova marcada. */
  nextExamDays: number | null;
  showAssignments: boolean;
  showExams: boolean;
}

/** "uma prova hoje" / "amanhã" / "em N dias" - por extenso perto do prazo, porque le melhor. */
function examPhrase(days: number): string {
  if (days <= 0) return 'uma prova hoje';
  if (days === 1) return 'uma prova amanhã';

  return `uma prova em ${days} dias`;
}

/**
 * Resumo da semana: entregas nos proximos 7 dias e a proxima prova, quando
 * houver - cada clausula so entra se o modulo dono (Atividades/Provas)
 * estiver ativo (Etapa 29.10).
 */
function buildSummary(
  dueThisWeekCount: number,
  nextExamDays: number | null,
  showAssignments: boolean,
  showExams: boolean,
): string {
  const parts: string[] = [];

  if (showAssignments && dueThisWeekCount > 0) {
    parts.push(
      `${dueThisWeekCount} ${dueThisWeekCount === 1 ? 'entrega' : 'entregas'} nesta semana`,
    );
  }

  if (showExams && nextExamDays !== null) parts.push(examPhrase(nextExamDays));

  if (parts.length > 0) return `Você tem ${parts.join(' e ')}.`;

  if (!showAssignments && !showExams) return 'Organize o resto do seu semestre por aqui.';

  return 'Nenhuma entrega ou prova esta semana. Aproveite para adiantar os estudos.';
}

export function Greeting({
  name,
  semesterName,
  dueThisWeekCount,
  nextExamDays,
  showAssignments,
  showExams,
}: GreetingProps) {
  const [greeting, setGreeting] = useState('Olá');
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    const now = new Date();

    setGreeting(getGreeting(now.getHours()));
    setDateLabel(formatTodayLabel(now));
  }, []);

  const firstName = name.split(' ')[0] ?? name;
  const summary = buildSummary(dueThisWeekCount, nextExamDays, showAssignments, showExams);

  return (
    <div>
      {/* Altura reservada mesmo antes do efeito rodar, para o cabecalho nao
          "pular" um pixel quando a data aparece. */}
      <p className="text-xs text-muted-foreground">{dateLabel || ' '}</p>

      <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
        {greeting}, {firstName}
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        {summary}
        {semesterName && <span className="hidden sm:inline"> · Semestre {semesterName}</span>}
      </p>
    </div>
  );
}
