import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const token = z.object({
  token: z
    .string()
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token de notificação inválido'),
});

/** RF27: aparelhos que recebem notificação com o app fechado. */
export function rotasPush(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);

  r.put('/eu/push', logado, async (req, res) => {
    await servico.registrar(ctx, quem(req), token.parse(req.body).token);
    res.status(204).end();
  });

  r.delete('/eu/push', logado, async (req, res) => {
    await servico.remover(ctx, quem(req), token.parse(req.body).token);
    res.status(204).end();
  });

  return r;
}
