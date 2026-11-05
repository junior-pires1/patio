import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const alvo = z.object({ paraId: z.uuid('Identificador inválido') });
const curtida = alvo.extend({ super: z.boolean().optional().default(false) });
const idMatch = z.object({ id: z.uuid('Identificador inválido') });
const filtroDescobrir = z
  .object({
    objetivo: z.enum(['GRUPO_ESTUDOS', 'MONITORIA', 'PROJETOS', 'AMIZADE']).optional(),
    ajudaEm: z.uuid('Disciplina inválida').optional(),
    cursoId: z.uuid('Curso inválido').optional(),
    turno: z.enum(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL']).optional(),
    semestreMin: z.coerce.number().int().min(1).max(12).optional(),
    semestreMax: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((f) => !f.semestreMin || !f.semestreMax || f.semestreMin <= f.semestreMax, {
    message: 'O semestre mínimo não pode ser maior que o máximo',
    path: ['semestreMin'],
  });

/** Descoberta, curtidas, pulos e conexões (só alunos). */
export function rotasConexoes(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/descobrir', ...aluno, async (req, res) => {
    res.json(await servico.descobrir(ctx, quem(req), filtroDescobrir.parse(req.query)));
  });

  r.post('/curtidas', ...aluno, async (req, res) => {
    const { paraId, super: superCurtida } = curtida.parse(req.body);
    res.status(201).json(await servico.curtir(ctx, quem(req), paraId, superCurtida));
  });

  r.get('/curtidas/recebidas', ...aluno, async (req, res) => {
    res.json(await servico.contarCurtidasRecebidas(ctx, quem(req)));
  });

  r.post('/pulos', ...aluno, async (req, res) => {
    const { paraId } = alvo.parse(req.body);
    await servico.pular(ctx, quem(req), paraId);
    res.status(204).end();
  });

  r.get('/eu/super-curtidas', ...aluno, async (req, res) => {
    res.json(await servico.superCurtidasRestantes(ctx, quem(req)));
  });

  r.delete('/pulos/ultimo', ...aluno, async (req, res) => {
    res.json(await servico.desfazerPulo(ctx, quem(req)));
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
