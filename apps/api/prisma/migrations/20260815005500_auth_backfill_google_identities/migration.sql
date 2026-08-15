-- Etapa 3 do plano de autenticacao e-mail+senha: cria a AuthIdentity
-- correspondente para cada usuario que ja tem googleId, sem perder nem
-- duplicar ninguem.
--
-- gen_random_uuid() vem da extensao pgcrypto, ja habilitada neste banco
-- (usada por outras migracoes do projeto). Cada linha gerada aqui casa
-- exatamente com o formato de id usado pelo restante do schema (cuid via
-- Prisma para todo o resto, uuid so nesta migracao de backfill pontual).
INSERT INTO "auth_identities" ("id", "provider", "providerAccountId", "userId", "createdAt")
SELECT gen_random_uuid()::text, 'GOOGLE', "googleId", "id", now()
FROM "users"
WHERE "googleId" IS NOT NULL;

-- Confere que todo usuario com googleId ganhou exatamente 1 AuthIdentity
-- antes de a migracao ser dada como concluida. Se divergir, a migracao
-- inteira e revertida (roda dentro da mesma transacao que o INSERT acima).
DO $$
DECLARE
  users_with_google integer;
  identities_created integer;
BEGIN
  SELECT count(*) INTO users_with_google FROM "users" WHERE "googleId" IS NOT NULL;
  SELECT count(*) INTO identities_created FROM "auth_identities" WHERE "provider" = 'GOOGLE';

  IF users_with_google <> identities_created THEN
    RAISE EXCEPTION 'Backfill de AuthIdentity divergiu: % usuarios com googleId, % identidades criadas', users_with_google, identities_created;
  END IF;
END $$;
