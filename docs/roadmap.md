# Roadmap

| # | Etapa | Status |
|---|-------|--------|
| 1 | Ambiente, Docker, Prisma, PostgreSQL, ESLint, Prettier | ✅ |
| 2 | Autenticação (Google OAuth, JWT, middleware) | ✅ |
| 3 | Layout, Sidebar, Navbar, Dashboard | ✅ |
| 4 | CRUD de Disciplinas | ✅ |
| 5 | CRUD de Atividades | ✅ |
| 6 | CRUD de Provas | ✅ |
| 7 | Calendário | ✅ |
| 8 | Integração Google Classroom | ✅ |
| 9 | Integração Google Calendar | ✅ |
| 10 | Controle de Notas | ✅ |
| 11 | Histórico | ✅ |
| 12 | Upload de Materiais | ✅ |
| 13 | Flashcards | ✅ |
| 14 | Cronograma de Estudos | ✅ |
| 15 | Estatísticas | ✅ |
| 16 | Testes, refatoração, documentação, deploy | ✅ |
| 17 | Notas configuráveis (componentes de avaliação, Simulação) | ✅ |
| 18 | Modelo de semestre sólido (padrão N1/N2/N3, propagação para disciplinas) | ✅ |
| 19 | Busca global (⌘K) e central de notificações | ✅ |
| 20 | Turmas: fundação (turma, membros, convite, disciplinas) | ✅ |
| 21 | Turmas: publicação compartilhada (atividades, provas, eventos) | ✅ |
| 22 | Turmas: mural (avisos e anotações) | ✅ |
| 23 | Turmas: materiais compartilhados | ✅ |
| 24 | Turmas: refinamentos (transferência de dono, arquivamento) | ✅ |
| 25 | Envio de e-mail | 🚧 planejado |
| 26 | Autenticação: e-mail + senha, vínculo com Google (ver [documentação](modules/autenticacao.md)) | ✅ |
| 27 | Plano de Estudos: espaço de preparação por prova, com flashcards, materiais e cronograma integrados (ver [documentação](modules/plano-de-estudos.md)) | ✅ |
| 28 | PWA: instalação no celular, Service Worker, offline básico, navegação inferior mobile e Push Notifications (ver [documentação](modules/pwa.md)) | ✅ |
| 29 | Módulos configuráveis: Configurações, ativar/desativar módulos sem perder dados, simplificação de Sidebar e Dashboard (ver [documentação](modules/modulos-configuraveis.md)) | ✅ |
| 30 | Semestre como hierarquia central: Turma passa a referenciar Semestre de verdade, Período do curso (1-8), ação "Finalizar semestre" e limite de uma turma ativa por aluno (ver [documentação](modules/turmas.md)) | ✅ |
| 31 | Semestre automático: elimina o cadastro manual de semestre, sempre calculado pela data atual (ver [documentação](modules/historico.md)) | ✅ |
| 32 | Turma: vira semestre/período automaticamente pelo calendário, removendo a ação manual "Finalizar semestre" (mesmo princípio da Etapa 31, aplicado à turma) (ver [planejamento](planning/turma-semestre-automatico.md)) | 🚧 planejado |
| 33 | Janela de tolerância na rotação do refresh token: evita que uma corrida legítima (retry de rede, app suspenso em segundo plano) derrube a sessão de outros aparelhos (ver [planejamento](planning/refresh-token-grace-period.md)) | 🚧 planejado |

Contribuições: veja [CONTRIBUTING.md](CONTRIBUTING.md).
