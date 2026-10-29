import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const alvo = z.object({ paraId: z.uuid('Identificador inválido') });
const idMatch = z.object({ id: z.uuid('Identificador inválido') });

/** Descoberta, curtidas, pulos e conexões (só alunos). */
export function rotasConexoes(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx.segredoJwt), exigirPapel('ALUNO')];

  r.get('/descobrir', ...aluno, async (req, res) => {
    res.json(await servico.descobrir(ctx, quem(req)));
  });

  r.post('/curtidas', ...aluno, async (req, res) => {
    const { paraId } = alvo.parse(req.body);
    res.status(201).json(await servico.curtir(ctx, quem(req), paraId));
  });

  r.post('/pulos', ...aluno, async (req, res) => {
    const { paraId } = alvo.parse(req.body);
    await servico.pular(ctx, quem(req), paraId);
    res.status(204).end();
  });

  r.get('/matches', ...aluno, async (req, res) => {
    res.json(await servico.listarMatches(ctx, quem(req)));
  });

  r.delete('/matches/:id', ...aluno, async (req, res) => {
    const { id } = idMatch.parse(req.params);
    await servico.desfazer(ctx, quem(req), id);
    res.status(204).end();
  });

  return r;
}
