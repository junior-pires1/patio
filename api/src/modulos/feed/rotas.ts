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
  aba: z.enum(['todos', 'seguindo']).default('todos'),
});
const mencoes = z
  .array(z.uuid('Pessoa inválida'))
  .max(10, 'No máximo 10 pessoas marcadas')
  .optional();
const novoPost = z
  .object({
    categoria: z.enum(CATEGORIAS).default('GERAL'),
    texto: z.string().trim().max(500, 'No máximo 500 caracteres').default(''),
    imagemId: z.uuid('Imagem inválida').optional(),
    eventoInicio: z.iso
      .datetime({ offset: true })
      .transform((t) => new Date(t))
      .optional(),
    eventoLocal: z.string().trim().max(120).optional(),
    mencoes: mencoes,
  })
  .refine((p) => (typeof p.texto === 'string' && p.texto.length > 0) || p.imagemId, {
    message: 'Escreva alguma coisa ou escolha uma imagem',
    path: ['texto'],
  })
  .refine((p) => p.categoria !== 'EVENTO' || p.eventoInicio, {
    message: 'Evento precisa de data e hora de início',
    path: ['eventoInicio'],
  })
  // Uma hora de folga para quem publica o evento enquanto ele começa.
  .refine(
    (p) =>
      !(p.eventoInicio instanceof Date) ||
      p.eventoInicio.getTime() > Date.now() - 3_600_000,
    {
      message: 'O evento não pode ser no passado',
      path: ['eventoInicio'],
    },
  );
const novoComentario = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário')
    .max(300, 'No máximo 300 caracteres'),
  paiId: z.uuid('Comentário inválido').optional(),
  mencoes,
});
const hashtag = z.object({
  tag: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}_]{2,40}$/u, 'Hashtag inválida')
    .transform((t) => t.toLowerCase()),
});
const antes = z.object({ antes: z.iso.datetime({ offset: true }).optional() });

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
        seguidosPor: f.aba === 'seguindo' ? quem(req).id : undefined,
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
    res
      .status(201)
      .json(
        await servico.comentar(
          ctx,
          quem(req),
          id.parse(req.params).id,
          novoComentario.parse(req.body),
        ),
      );
  });
  r.put('/comentarios/:id/curtida', logado, async (req, res) => {
    res.json(await servico.curtirComentario(ctx, quem(req), id.parse(req.params).id, true));
  });
  r.delete('/comentarios/:id/curtida', logado, async (req, res) => {
    res.json(
      await servico.curtirComentario(ctx, quem(req), id.parse(req.params).id, false),
    );
  });

  r.put('/posts/:id/salvo', logado, async (req, res) => {
    res.json(await servico.salvarPost(ctx, quem(req), id.parse(req.params).id, true));
  });
  r.delete('/posts/:id/salvo', logado, async (req, res) => {
    res.json(await servico.salvarPost(ctx, quem(req), id.parse(req.params).id, false));
  });
  r.get('/eu/salvos', logado, async (req, res) => {
    const f = antes.parse(req.query);
    const eu = quem(req);
    res.json(
      await servico.listarPosts(ctx, eu, {
        salvoPor: eu.id,
        antes: f.antes ? new Date(f.antes) : undefined,
      }),
    );
  });

  r.get('/hashtags/em-alta', logado, async (req, res) => {
    res.json(await servico.hashtagsEmAlta(ctx, quem(req)));
  });
  r.get('/hashtags/:tag/posts', logado, async (req, res) => {
    const f = antes.parse(req.query);
    res.json(
      await servico.listarPosts(ctx, quem(req), {
        hashtag: hashtag.parse(req.params).tag,
        antes: f.antes ? new Date(f.antes) : undefined,
      }),
    );
  });
  r.delete('/comentarios/:id', logado, async (req, res) => {
    await servico.apagarComentario(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  return r;
}
