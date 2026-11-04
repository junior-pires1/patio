import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const antes = z.object({ antes: z.iso.datetime({ offset: true }).optional() });

/** Central de notificações do aluno (curtidas, comentários, menções, conexões). */
export function rotasNotificacoes(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/notificacoes', ...aluno, async (req, res) => {
    const f = antes.parse(req.query);
    res.json(await servico.listar(ctx, quem(req), f.antes ? new Date(f.antes) : undefined));
  });
  r.get('/notificacoes/nao-lidas', ...aluno, async (req, res) => {
    res.json(await servico.naoLidas(ctx, quem(req)));
  });
  r.post('/notificacoes/lidas', ...aluno, async (req, res) => {
    await servico.marcarLidas(ctx, quem(req));
    res.status(204).end();
  });
  return r;
}
