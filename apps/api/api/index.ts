import { createApp } from '../src/app.js';

/**
 * Entrypoint da funcao serverless da Vercel.
 *
 * Uma app Express e, na pratica, uma funcao `(req, res) => void` - a Vercel
 * aceita o export default dela diretamente, sem wrapper. O roteamento interno
 * (`/api/v1/...`) continua igual: `vercel.json` reescreve toda requisicao
 * para ca preservando o caminho original.
 *
 * Sem `app.listen()` nem conexao/desconexao explicita com o banco: quem
 * gerencia o ciclo de vida da funcao e a Vercel, e o client do Prisma (ver
 * `config/prisma.ts`) se conecta sob demanda na primeira query.
 */
export default createApp();
