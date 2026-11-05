import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });
const antes = z.object({ antes: z.iso.datetime({ offset: true }).optional() });
const data = z.iso
  .date('Use o formato AAAA-MM-DD')
  .transform((t) => new Date(`${t}T00:00:00Z`));
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

const datasValidas = (e: { inicio: unknown; fim?: unknown }) =>
  e.inicio instanceof Date &&
  (e.fim === null || e.fim === undefined || e.fim instanceof Date);

const experiencia = z
  .object({
    tipo: z.enum(servico.TIPOS_DE_EXPERIENCIA),
    titulo: z.string().trim().min(2, 'Informe o título').max(100),
    organizacao: textoOpcional(100),
    inicio: data,
    fim: data.nullable().optional(),
    descricao: textoOpcional(500),
    link: z
      .url({ protocol: /^https?$/, message: 'Link inválido (comece com https://)' })
      .max(300)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
  })
  // Se uma das datas já falhou no formato, as regras abaixo não rodam (senão viram erro 500).
  .refine((e) => !datasValidas(e) || !e.fim || e.fim >= e.inicio, {
    message: 'O fim não pode ser antes do início',
    path: ['fim'],
  })
  .refine(
    (e) =>
      !datasValidas(e) ||
      (e.inicio.getUTCFullYear() >= 1960 &&
        e.inicio.getTime() < Date.now() + 366 * 86_400_000),
    {
      message: 'Confira a data de início',
      path: ['inicio'],
    },
  );
const habilidade = z.object({ habilidade: z.string().trim().min(1).max(40) });
const busca = z.object({
  q: z.string().trim().min(2, 'Digite pelo menos 2 letras').max(60),
  tipo: z.enum(['tudo', 'pessoas', 'posts', 'grupos']).default('tudo'),
});
const dataDe = (v?: string) => (v ? new Date(v) : undefined);

/** Perfil social: perfil completo, experiências, recomendações, busca e histórico de curtidas. */
export function rotasSocial(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const aluno = [logado, exigirPapel('ALUNO')];

  r.get('/usuarios/:id/perfil', logado, async (req, res) => {
    res.json(await servico.perfilCompleto(ctx, quem(req), id.parse(req.params).id));
  });

  r.get('/usuarios/:id/posts', logado, async (req, res) => {
    const filtro = antes.parse(req.query);
    res.json(
      await servico.postsDoUsuario(
        ctx,
        quem(req),
        id.parse(req.params).id,
        dataDe(filtro.antes),
      ),
    );
  });

  r.post('/eu/experiencias', ...aluno, async (req, res) => {
    res
      .status(201)
      .json(await servico.criarExperiencia(ctx, quem(req), experiencia.parse(req.body)));
  });

  r.put('/eu/experiencias/:id', ...aluno, async (req, res) => {
    res.json(
      await servico.editarExperiencia(
        ctx,
        quem(req),
        id.parse(req.params).id,
        experiencia.parse(req.body),
      ),
    );
  });

  r.delete('/eu/experiencias/:id', ...aluno, async (req, res) => {
    await servico.removerExperiencia(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.put('/usuarios/:id/recomendacoes', ...aluno, async (req, res) => {
    const { habilidade: h } = habilidade.parse(req.body);
    res.json(await servico.recomendar(ctx, quem(req), id.parse(req.params).id, h, true));
  });

  r.delete('/usuarios/:id/recomendacoes', ...aluno, async (req, res) => {
    const { habilidade: h } = habilidade.parse(req.body);
    res.json(await servico.recomendar(ctx, quem(req), id.parse(req.params).id, h, false));
  });

  r.get('/busca', logado, async (req, res) => {
    res.json(await servico.buscar(ctx, quem(req), busca.parse(req.query)));
  });

  r.get('/eu/curtidas', ...aluno, async (req, res) => {
    res.json(await servico.curtidasFeitas(ctx, quem(req)));
  });

  r.get('/eu/curtidas/recebidas', ...aluno, async (req, res) => {
    res.json(await servico.curtidasRecebidas(ctx, quem(req)));
  });

  r.delete('/curtidas/:id', ...aluno, async (req, res) => {
    await servico.descurtirPessoa(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.put('/usuarios/:id/seguir', ...aluno, async (req, res) => {
    res.json(await servico.seguir(ctx, quem(req), id.parse(req.params).id, true));
  });

  r.delete('/usuarios/:id/seguir', ...aluno, async (req, res) => {
    res.json(await servico.seguir(ctx, quem(req), id.parse(req.params).id, false));
  });

  r.get('/usuarios/:id/seguidores', logado, async (req, res) => {
    res.json(
      await servico.listarSeguidores(ctx, quem(req), id.parse(req.params).id, 'seguidores'),
    );
  });

  r.get('/usuarios/:id/seguindo', logado, async (req, res) => {
    res.json(
      await servico.listarSeguidores(ctx, quem(req), id.parse(req.params).id, 'seguindo'),
    );
  });

  r.get('/eu/visitas', ...aluno, async (req, res) => {
    res.json(await servico.visitasAoPerfil(ctx, quem(req)));
  });

  r.get('/eu/posts-curtidos', logado, async (req, res) => {
    const filtro = antes.parse(req.query);
    res.json(await servico.postsCurtidos(ctx, quem(req), dataDe(filtro.antes)));
  });

  return r;
}
