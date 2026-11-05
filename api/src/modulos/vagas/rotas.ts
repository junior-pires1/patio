import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });
const candidato = z.object({
  id: z.uuid('Identificador inválido'),
  usuarioId: z.uuid('Identificador inválido'),
});
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => v || null);

const novaVaga = z.object({
  tipo: z.enum(servico.TIPOS_DE_VAGA),
  titulo: z.string().trim().min(3, 'Informe o título').max(100),
  organizacao: textoOpcional(100),
  descricao: z.string().trim().min(10, 'Descreva a vaga (10 letras ou mais)').max(1500),
  local: textoOpcional(100),
  modalidade: z.enum(servico.MODALIDADES).default('PRESENCIAL'),
  link: z
    .url({ protocol: /^https?$/, message: 'Link inválido (comece com https://)' })
    .max(300)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  prazo: z.iso
    .date('Use o formato AAAA-MM-DD')
    .transform((t) => new Date(`${t}T00:00:00Z`))
    .nullable()
    .optional(),
});
const filtro = z.object({
  tipo: z.enum(servico.TIPOS_DE_VAGA).optional(),
  modalidade: z.enum(servico.MODALIDADES).optional(),
  q: z.string().trim().max(60).optional(),
  lado: z.enum(['abertas', 'minhas', 'candidaturas']).default('abertas'),
});
const candidatura = z.object({ mensagem: textoOpcional(500) });
const status = z.object({ status: z.enum(servico.STATUS_DA_CANDIDATURA) });

/** Vagas e oportunidades da faculdade. */
export function rotasVagas(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const aluno = [logado, exigirPapel('ALUNO')];

  r.get('/vagas', logado, async (req, res) => {
    const f = filtro.parse(req.query);
    res.json(await servico.listarVagas(ctx, quem(req), { ...f, q: f.q || undefined }));
  });

  r.post('/vagas', logado, async (req, res) => {
    res.status(201).json(await servico.criarVaga(ctx, quem(req), novaVaga.parse(req.body)));
  });

  r.get('/vagas/:id', logado, async (req, res) => {
    res.json(await servico.verVaga(ctx, quem(req), id.parse(req.params).id));
  });

  r.post('/vagas/:id/encerrar', logado, async (req, res) => {
    res.json(await servico.encerrarVaga(ctx, quem(req), id.parse(req.params).id));
  });

  r.post('/vagas/:id/candidatura', ...aluno, async (req, res) => {
    const { mensagem } = candidatura.parse(req.body ?? {});
    res
      .status(201)
      .json(await servico.candidatar(ctx, quem(req), id.parse(req.params).id, mensagem));
  });

  r.delete('/vagas/:id/candidatura', ...aluno, async (req, res) => {
    await servico.desistir(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.get('/vagas/:id/candidatos', logado, async (req, res) => {
    res.json(await servico.candidatosDaVaga(ctx, quem(req), id.parse(req.params).id));
  });

  r.put('/vagas/:id/candidatos/:usuarioId', logado, async (req, res) => {
    const p = candidato.parse(req.params);
    res.json(
      await servico.atualizarCandidatura(
        ctx,
        quem(req),
        p.id,
        p.usuarioId,
        status.parse(req.body).status,
      ),
    );
  });

  return r;
}
