import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });
const filtro = z.object({
  disciplinaId: z.uuid().optional(),
  meus: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
const novoGrupo = z.object({
  nome: z.string().trim().min(3, 'Dê um nome ao grupo').max(80),
  descricao: textoOpcional(300),
  disciplinaId: z.uuid().optional(),
  encontro: textoOpcional(80),
  local: textoOpcional(80),
  vagas: z
    .number()
    .int()
    .min(3, 'Mínimo de 3 vagas')
    .max(20, 'Máximo de 20 vagas')
    .default(10),
});
const pagina = z.object({ antes: z.iso.datetime({ offset: true }).optional() });
const mensagem = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'Escreva uma mensagem')
    .max(1000, 'No máximo 1.000 caracteres'),
});

/** Grupos de estudo (RF22–RF24). Só alunos participam. */
export function rotasGrupos(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/grupos', ...aluno, async (req, res) => {
    res.json(await servico.listarGrupos(ctx, quem(req), filtro.parse(req.query)));
  });
  r.post('/grupos', ...aluno, async (req, res) => {
    res
      .status(201)
      .json(await servico.criarGrupo(ctx, quem(req), novoGrupo.parse(req.body)));
  });
  r.get('/grupos/:id', ...aluno, async (req, res) => {
    res.json(await servico.verGrupo(ctx, quem(req), id.parse(req.params).id));
  });
  r.post('/grupos/:id/entrar', ...aluno, async (req, res) => {
    res.json(await servico.entrar(ctx, quem(req), id.parse(req.params).id));
  });
  r.post('/grupos/:id/sair', ...aluno, async (req, res) => {
    res.json(await servico.sair(ctx, quem(req), id.parse(req.params).id));
  });
  r.get('/grupos/:id/mensagens', ...aluno, async (req, res) => {
    const { antes } = pagina.parse(req.query);
    res.json(
      await servico.listarMensagens(
        ctx,
        quem(req),
        id.parse(req.params).id,
        antes ? new Date(antes) : undefined,
      ),
    );
  });
  r.post('/grupos/:id/mensagens', ...aluno, async (req, res) => {
    const { texto } = mensagem.parse(req.body);
    res
      .status(201)
      .json(await servico.enviarMensagem(ctx, quem(req), id.parse(req.params).id, texto));
  });

  return r;
}
