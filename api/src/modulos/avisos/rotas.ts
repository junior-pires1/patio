import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const novoAviso = z.object({
  titulo: z.string().trim().min(3, 'Escreva um título').max(80, 'No máximo 80 caracteres'),
  texto: z.string().trim().min(1, 'Escreva o aviso').max(500, 'No máximo 500 caracteres'),
  fixado: z.boolean().default(true),
});
const idAviso = z.object({ id: z.uuid('Identificador inválido') });

/** Avisos: alunos e coordenação leem; só a coordenação publica e remove. */
export function rotasAvisos(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const coordenacao = [logado, exigirPapel('COORDENACAO')];

  r.get('/avisos', logado, async (req, res) => {
    res.json(await servico.listarAvisos(ctx, quem(req)));
  });

  r.post('/coordenacao/avisos', ...coordenacao, async (req, res) => {
    res
      .status(201)
      .json(await servico.publicarAviso(ctx, quem(req), novoAviso.parse(req.body)));
  });

  r.delete('/coordenacao/avisos/:id', ...coordenacao, async (req, res) => {
    const { id } = idAviso.parse(req.params);
    await servico.removerAviso(ctx, quem(req), id);
    res.status(204).end();
  });

  return r;
}
