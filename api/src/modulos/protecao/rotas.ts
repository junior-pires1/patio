import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const usuario = z.object({ usuarioId: z.uuid('Identificador inválido') });
const denuncia = z.object({
  denunciadoId: z.uuid('Identificador inválido'),
  motivo: z.enum([
    'PERFIL_FALSO',
    'ASSEDIO',
    'CONTEUDO_IMPROPRIO',
    'SPAM',
    'VENDA_DE_TRABALHOS',
    'OUTRO',
  ]),
  detalhe: z.string().trim().max(500, 'No máximo 500 caracteres').optional(),
  bloquear: z.boolean().default(false),
});

/** Bloqueios e denúncias (segurança dos alunos). */
export function rotasProtecao(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/bloqueios', ...aluno, async (req, res) => {
    res.json(await servico.listarBloqueios(ctx, quem(req)));
  });

  r.post('/bloqueios', ...aluno, async (req, res) => {
    const { usuarioId } = usuario.parse(req.body);
    await servico.bloquear(ctx, quem(req), usuarioId);
    res.status(204).end();
  });

  r.delete('/bloqueios/:usuarioId', ...aluno, async (req, res) => {
    const { usuarioId } = usuario.parse(req.params);
    await servico.desbloquear(ctx, quem(req), usuarioId);
    res.status(204).end();
  });

  r.post('/denuncias', ...aluno, async (req, res) => {
    res.status(201).json(await servico.denunciar(ctx, quem(req), denuncia.parse(req.body)));
  });

  return r;
}
