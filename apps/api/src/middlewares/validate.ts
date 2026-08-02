import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Middleware de validacao usado por todas as rotas.
 *
 * Substitui `req.body` / `req.query` / `req.params` pelo resultado *parseado*
 * do Zod, entao coercoes (string -> number, string -> Date) e defaults chegam
 * prontos ao controller. Erros de parse sao repassados ao error handler global,
 * que ja sabe formatar ZodError.
 */

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Request['params'];
      }

      if (schemas.query) {
        // No Express 5 `req.query` e um getter sem setter; definimos a
        // propriedade explicitamente para expor o valor ja validado.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
        });
      }

      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
