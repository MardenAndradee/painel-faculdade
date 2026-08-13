/**
 * Casamento de disciplinas ao entrar numa turma (Etapa 20).
 *
 * Funcao pura, sem banco: para cada `ClassSubject` da turma, decide se ha uma
 * `Subject` do usuario que deva ser reaproveitada (mesmo nome, normalizado)
 * ou se uma nova precisa ser criada. O service so executa a decisao - a
 * regra de casamento fica testavel sem subir Postgres, no mesmo espirito de
 * `grade-template-merge`.
 *
 * Duas disciplinas de turmas diferentes podem legitimamente casar com a
 * MESMA `Subject` do usuario (ex.: entrar em duas turmas de "Redes de
 * Computadores") - por isso, ao contrario da fusao de notas, aqui nao ha
 * consumo: o casamento e independente por `ClassSubject`.
 */

export interface ClassSubjectToMatch {
  id: string;
  name: string;
}

export interface ExistingSubjectCandidate {
  id: string;
  name: string;
  /** Disciplina arquivada nunca e reaproveitada - o membro a arquivou por um motivo. */
  archivedAt: Date | null;
}

export type ClassSubjectMatch =
  | { classSubjectId: string; action: 'link'; subjectId: string }
  | { classSubjectId: string; action: 'create' };

/**
 * Normaliza para comparacao: remove acentos, ignora caixa e espacos nas
 * pontas. "Redes de Computadores" e "redes   de computadores" (com espacos
 * simples apos trim) casam; "Cálculo III" e "calculo iii" tambem.
 */
function matchKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function matchClassSubjects(
  classSubjects: ClassSubjectToMatch[],
  existingSubjects: ExistingSubjectCandidate[],
): ClassSubjectMatch[] {
  const byKey = new Map<string, ExistingSubjectCandidate>();

  for (const subject of existingSubjects) {
    if (subject.archivedAt) continue;

    const key = matchKey(subject.name);

    // Duas disciplinas ativas homonimas: a primeira encontrada vence: a
    // decisao de qual e "a" disciplina cabe ao usuario, nao a este casamento.
    if (!byKey.has(key)) byKey.set(key, subject);
  }

  return classSubjects.map((classSubject) => {
    const match = byKey.get(matchKey(classSubject.name));

    return match
      ? { classSubjectId: classSubject.id, action: 'link' as const, subjectId: match.id }
      : { classSubjectId: classSubject.id, action: 'create' as const };
  });
}
