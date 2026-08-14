# Padrões de código

- **TypeScript estrito.** `any` é erro de lint, não aviso.
- **Sem regra de negócio em controller.** Toda lógica vive em `services/`.
- **Prisma só em repositories.**
- **Erros previsíveis** usam `AppError`; o resto vira 500 sem vazar detalhes internos em produção.
- **Comentários explicam o porquê**, não o quê.
- **`.partial()` do Zod NÃO remove `.default()`.** Um schema de update derivado de `createSchema.partial()` aplica os defaults nos campos ausentes — e um PATCH parcial sobrescreve silenciosamente o que não foi enviado. Por isso cada entidade tem um `xBaseSchema` **sem defaults**: a criação faz `base.extend({...defaults})` e a edição faz `base.partial()`.
- **Mensagens de validação em português**, inclusive para campo ausente ou vazio. `z.string().min(2, 'msg')` cobre só o `min`; para o campo faltando é preciso `z.string({ error: 'msg' })`, e para campo vazio vindo de formulário a mensagem também precisa estar no `.min(1, 'msg')`.

O Husky roda `lint-staged` no pre-commit: ESLint e Prettier nos arquivos em stage.

