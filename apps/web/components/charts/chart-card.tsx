'use client';

import { useId, useState } from 'react';
import { Table2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';

interface ChartCardProps {
  title: string;
  description?: string;
  /** Selo opcional ao lado do título (ex.: variação percentual). */
  badge?: React.ReactNode;
  /** Cabeçalhos da tabela equivalente. */
  tableHeaders: [string, ...string[]];
  /** Linhas da tabela equivalente, já formatadas. */
  tableRows: string[][];
  /** Verdadeiro quando não há nada para desenhar. */
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

/**
 * Moldura de um grafico.
 *
 * Todo grafico tem uma tabela equivalente, alcancavel por um botao. Isso nao e
 * enfeite de acessibilidade: um grafico que so pode ser lido por cor e posicao
 * exclui quem usa leitor de tela e quem precisa do numero exato. A tabela e a
 * versao WCAG-limpa do mesmo dado.
 */
export function ChartCard({
  title,
  description,
  badge,
  tableHeaders,
  tableRows,
  isEmpty = false,
  emptyMessage = 'Sem dados no período selecionado.',
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const regionId = useId();

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">{title}</h2>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>

        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-pressed={showTable}
            aria-controls={regionId}
            onClick={() => setShowTable((current) => !current)}
          >
            {showTable ? (
              <>
                <TrendingUp className="size-4" aria-hidden />
                Gráfico
              </>
            ) : (
              <>
                <Table2 className="size-4" aria-hidden />
                Tabela
              </>
            )}
          </Button>
        )}
      </div>

      <div id={regionId} className="mt-4 min-w-0">
        {isEmpty ? (
          <EmptyState icon={TrendingUp} title="Nada para mostrar" description={emptyMessage} />
        ) : showTable ? (
          /* `overflow-x-auto` no contêiner da tabela: conteúdo largo rola
             dentro dele, nunca empurra a página inteira para o lado. */
          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  {tableHeaders.map((header, index) => (
                    <th
                      key={header}
                      scope="col"
                      className={`px-3 py-2 font-medium ${index === 0 ? 'text-left' : 'text-right'}`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={
                          cellIndex === 0
                            ? 'px-3 py-1.5'
                            : // `tabular-nums` só aqui: números que se alinham
                              // verticalmente em linhas de tabela.
                              'px-3 py-1.5 text-right tabular-nums'
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
