import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { ok } from '../utils/http-response.js';

/**
 * Health check consultado pelo Docker e por qualquer orquestrador.
 * Toca o banco de proposito: um processo vivo com banco fora do ar nao esta saudavel.
 */
export const healthRoutes: Router = Router();

healthRoutes.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  ok(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: 'connected',
  });
});
