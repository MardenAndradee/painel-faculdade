'use client';

import { useEffect, useState } from 'react';

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

interface GreetingProps {
  name: string;
  semesterName: string | null;
  pendingCount: number;
  overdueCount: number;
}

export function Greeting({ name, semesterName, pendingCount, overdueCount }: GreetingProps) {
  const [greeting, setGreeting] = useState('Olá');

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  const firstName = name.split(' ')[0] ?? name;

  const summary =
    overdueCount > 0
      ? `Você tem ${overdueCount} ${overdueCount === 1 ? 'atividade atrasada' : 'atividades atrasadas'} e ${pendingCount} em aberto.`
      : pendingCount > 0
        ? `Você tem ${pendingCount} ${pendingCount === 1 ? 'atividade em aberto' : 'atividades em aberto'}. Nada atrasado.`
        : 'Nenhuma atividade pendente. Tudo em dia!';

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {greeting}, {firstName}
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        {summary}
        {semesterName && <span className="hidden sm:inline"> · Semestre {semesterName}</span>}
      </p>
    </div>
  );
}
