# Painel Faculdade

Plataforma web de organização acadêmica para estudantes universitários. Centraliza disciplinas, atividades, provas, notas, materiais, flashcards e cronograma de estudos em um único lugar, com integração ao Google Classroom e ao Google Calendar.

## Funcionalidades

- **Disciplinas e semestres** — organização por período letivo, com professores e situação (cursando, aprovado, reprovado...)
- **Atividades e provas** — manuais ou importadas do Google Classroom, com prazos, prioridade e anexos
- **Notas** — componentes de avaliação configuráveis por disciplina, cálculo de nota necessária para aprovação e simulação de cenários
- **Calendário** — eventos manuais e sincronizados com o Google Calendar
- **Materiais** — upload de arquivos ou links, vinculáveis a disciplinas, atividades ou provas
- **Flashcards** — repetição espaçada (SM-2) por baralho
- **Plano de Estudos** — espaço de preparação por prova, reunindo conteúdos, objetivos, anotações, materiais e flashcards
- **Cronograma de estudos** — geração automática de sessões de estudo a partir da disponibilidade semanal e dos prazos pendentes
- **Estatísticas** — desempenho por disciplina/semestre, tempo estudado, adesão ao cronograma
- **Busca global** (⌘K) e central de notificações
- **Turmas** — compartilhamento de atividades, provas, avisos e materiais entre colegas
- **Histórico** — consolidado de semestres já concluídos

## Stack

| Camada        | Tecnologias                                                              |
| ------------- | ------------------------------------------------------------------------ |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, cmdk |
| Estado/dados  | TanStack Query, React Hook Form, Zod                                     |
| Backend       | Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL 18                  |
| Autenticação  | Google OAuth2, JWT, Refresh Token                                        |
| Ferramentas   | Docker, Docker Compose, ESLint, Prettier, Husky, lint-staged             |

Monorepo com **npm workspaces**: `apps/api` (backend Express), `apps/web` (frontend Next.js) e `packages/shared` (schemas Zod e tipos compartilhados entre os dois).

## Instalação

Pré-requisitos: **Node.js ≥ 20.19**, **PostgreSQL 18** (local ou via Docker).

```bash
git clone <url-do-repositorio>
cd painel-faculdade
npm install

# arquivos de ambiente
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# gerar segredos JWT (colar em apps/api/.env)
openssl rand -base64 48
openssl rand -base64 48

npm run db:migrate
npm run db:seed
npm run dev
```

| Serviço | URL |
| ------- | --- |
| Web     | http://localhost:3000 |
| API     | http://localhost:3333/api/v1 |

O login com Google exige credenciais OAuth próprias (Google Cloud Console); sem elas, o restante da aplicação sobe normalmente. Todas as variáveis de ambiente, o passo a passo do OAuth e as opções de deploy (Docker e Vercel + Neon + R2) estão documentados à parte — veja abaixo.

## Documentação

Este README cobre só o essencial para rodar o projeto. Notas internas de
desenvolvimento — arquitetura e decisões de design, como cada módulo
funciona por dentro, banco de dados, deploy, padrões de código, roadmap por
etapas e planos de funcionalidades futuras — ficam na pasta [`docs/`](docs/INDEX.md).

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de trabalho, padrão de commits e checagens exigidas antes de um PR.
