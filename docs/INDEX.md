# Documentação interna

Notas de desenvolvimento do Painel Faculdade — arquitetura, decisões, etapas,
deploy e planos. O `README.md` na raiz é a porta de entrada (visão geral e
como rodar o projeto); esta pasta é onde vive o detalhe.

Todo o conteúdo aqui veio de uma reorganização do `README.md`, que antes
acumulava mais de 3200 linhas misturando apresentação do projeto com notas
de desenvolvimento. Nada foi perdido na mudança — só reorganizado.

## Índice

- [architecture.md](architecture.md) — Arquitetura do monorepo, decisões de design, estrutura de pastas, identidade visual, banco de dados (20 entidades) e a migração que quebra em banco com dados
- [setup.md](setup.md) — Pré-requisitos, instalação local, Google OAuth, variáveis de ambiente, Docker (dev) e scripts npm
- [deploy.md](deploy.md) — Deploy via Docker Compose (produção) e via Vercel + Neon + R2
- [testing.md](testing.md) — Estratégia de testes (Vitest)
- [code-standards.md](code-standards.md) — Padrões de código do projeto
- [roadmap.md](roadmap.md) — Roadmap completo, etapa por etapa, com status

### Módulos (como cada funcionalidade já implementada funciona por dentro)

- [modules/autenticacao.md](modules/autenticacao.md)
- [modules/dashboard.md](modules/dashboard.md)
- [modules/disciplinas.md](modules/disciplinas.md)
- [modules/atividades.md](modules/atividades.md)
- [modules/provas.md](modules/provas.md)
- [modules/calendario.md](modules/calendario.md)
- [modules/google-classroom.md](modules/google-classroom.md)
- [modules/google-calendar.md](modules/google-calendar.md)
- [modules/notas.md](modules/notas.md)
- [modules/historico.md](modules/historico.md)
- [modules/materiais.md](modules/materiais.md)
- [modules/flashcards.md](modules/flashcards.md)
- [modules/cronograma.md](modules/cronograma.md)
- [modules/estatisticas.md](modules/estatisticas.md)
- [modules/turmas.md](modules/turmas.md)

### Planejamento (features aprovadas ou em análise, ainda não implementadas)

- [planning/autenticacao-email-senha.md](planning/autenticacao-email-senha.md)
- [planning/plano-de-estudos.md](planning/plano-de-estudos.md)

## Convenção

Ao concluir uma etapa de um plano em `planning/`, mova (ou funda) o conteúdo
correspondente para o arquivo de módulo em `modules/` e marque a etapa como
✅ em `roadmap.md` — mesmo padrão que o README já seguia antes da separação.
