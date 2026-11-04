import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });
const novoStory = z.object({
  imagemId: z.uuid('Escolha uma imagem'),
  legenda: z
    .string()
    .trim()
    .max(200, 'No máximo 200 caracteres')
    .optional()
    .transform((v) => v || null),
});
const titulo = z
  .string()
  .trim()
  .min(1, 'Dê um nome ao destaque')
  .max(30, 'No máximo 30 caracteres');
const storyIds = z
  .array(z.uuid())
  .min(1, 'Escolha pelo menos um story')
  .max(100, 'No máximo 100 stories');
const novoDestaque = z.object({ titulo, storyIds });
const edicaoDestaque = z
  .object({ titulo: titulo.optional(), storyIds: storyIds.optional() })
  .refine((d) => d.titulo || d.storyIds, 'Envie o título ou os stories');

/** Stories de 24 horas (só conexões veem) e destaques no perfil. Só alunos. */
export function rotasStories(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/stories', ...aluno, async (req, res) => {
    res.json(await servico.listarStories(ctx, quem(req)));
  });

  r.post('/stories', ...aluno, async (req, res) => {
    res
      .status(201)
      .json(await servico.publicarStory(ctx, quem(req), novoStory.parse(req.body)));
  });

  r.post('/stories/:id/visto', ...aluno, async (req, res) => {
    await servico.marcarVisto(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.get('/stories/:id/visualizacoes', ...aluno, async (req, res) => {
    res.json(await servico.visualizacoes(ctx, quem(req), id.parse(req.params).id));
  });

  r.delete('/stories/:id', ...aluno, async (req, res) => {
    await servico.apagarStory(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.get('/eu/stories/arquivo', ...aluno, async (req, res) => {
    res.json(await servico.arquivo(ctx, quem(req)));
  });

  r.get('/usuarios/:id/destaques', ...aluno, async (req, res) => {
    res.json(await servico.destaquesDe(ctx, quem(req), id.parse(req.params).id));
  });

  r.get('/destaques/:id', ...aluno, async (req, res) => {
    res.json(await servico.verDestaque(ctx, quem(req), id.parse(req.params).id));
  });

  r.post('/destaques', ...aluno, async (req, res) => {
    res
      .status(201)
      .json(await servico.criarDestaque(ctx, quem(req), novoDestaque.parse(req.body)));
  });

  r.patch('/destaques/:id', ...aluno, async (req, res) => {
    res.json(
      await servico.editarDestaque(
        ctx,
        quem(req),
        id.parse(req.params).id,
        edicaoDestaque.parse(req.body),
      ),
    );
  });

  r.delete('/destaques/:id', ...aluno, async (req, res) => {
    await servico.apagarDestaque(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  return r;
}
