import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const CATEGORIAS = ['GERAL', 'EVENTO', 'ESTUDOS', 'VAGA', 'ACHADOS'] as const;
const id = z.object({ id: z.uuid('Identificador inválido') });
const filtro = z.object({
  categoria: z.enum(CATEGORIAS).optional(),
  antes: z.iso.datetime({ offset: true }).optional(),
});
const novoPost = z
  .object({
    categoria: z.enum(CATEGORIAS).default('GERAL'),
    texto: z
      .string()
      .trim()
      .min(1, 'Escreva alguma coisa')
      .max(500, 'No máximo 500 caracteres'),
    imagemUrl: z
      .url({ protocol: /^https$/ })
      .max(300)
      .optional(),
    eventoInicio: z.iso
      .datetime({ offset: true })
      .transform((t) => new Date(t))
      .optional(),
    eventoLocal: z.string().trim().max(120).optional(),
  })
  .refine((p) => p.categoria !== 'EVENTO' || p.eventoInicio, {
    message: 'Evento precisa de data e hora de início',
    path: ['eventoInicio'],
  });
const texto = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário')
    .max(300, 'No máximo 300 caracteres'),
});

/** Feed da faculdade: publicações, curtidas, comentários e presença em eventos. */
export function rotasFeed(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);

  r.get('/feed', logado, async (req, res) => {
    const f = filtro.parse(req.query);
    res.json(
      await servico.listarFeed(ctx, quem(req), {
        categoria: f.categoria,
        antes: f.antes ? new Date(f.antes) : undefined,
      }),
    );
  });

  r.post('/posts', logado, async (req, res) => {
    res.status(201).json(await servico.publicar(ctx, quem(req), novoPost.parse(req.body)));
  });

  r.get('/posts/:id', logado, async (req, res) => {
    res.json(await servico.verPost(ctx, quem(req), id.parse(req.params).id));
  });

  r.delete('/posts/:id', logado, async (req, res) => {
    await servico.removerPost(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.put('/posts/:id/curtida', logado, async (req, res) => {
    res.json(await servico.curtirPost(ctx, quem(req), id.parse(req.params).id, true));
  });
  r.delete('/posts/:id/curtida', logado, async (req, res) => {
    res.json(await servico.curtirPost(ctx, quem(req), id.parse(req.params).id, false));
  });

  r.put('/posts/:id/presenca', logado, async (req, res) => {
    res.json(await servico.marcarPresenca(ctx, quem(req), id.parse(req.params).id, true));
  });
  r.delete('/posts/:id/presenca', logado, async (req, res) => {
    res.json(await servico.marcarPresenca(ctx, quem(req), id.parse(req.params).id, false));
  });

  r.get('/posts/:id/comentarios', logado, async (req, res) => {
    res.json(await servico.listarComentarios(ctx, quem(req), id.parse(req.params).id));
  });
  r.post('/posts/:id/comentarios', logado, async (req, res) => {
    const { texto: t } = texto.parse(req.body);
    res
      .status(201)
      .json(await servico.comentar(ctx, quem(req), id.parse(req.params).id, t));
  });
  r.delete('/comentarios/:id', logado, async (req, res) => {
    await servico.apagarComentario(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  return r;
}
