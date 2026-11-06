import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const faculdade = z.object({ instituicaoId: z.uuid('Faculdade inválida') });
const versao = z.object({ versao: z.coerce.number().int().min(1).max(100_000) });
const novoTexto = z.object({
  texto: z
    .string()
    .trim()
    .min(200, 'O termo precisa ter pelo menos 200 caracteres')
    .max(20_000, 'O termo pode ter até 20.000 caracteres'),
});

/** Termo de uso e privacidade (LGPD). */
export function rotasTermos(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const aluno = [logado, exigirPapel('ALUNO')];
  const coordenacao = [logado, exigirPapel('COORDENACAO')];

  // Público: o cadastro mostra o termo antes de a conta existir.
  r.get('/termos/:instituicaoId', async (req, res) => {
    res.json(await servico.termoPublico(ctx, faculdade.parse(req.params).instituicaoId));
  });

  r.get('/eu/termo', logado, async (req, res) => {
    res.json(await servico.meuTermo(ctx, quem(req)));
  });

  r.post('/eu/termo/aceite', ...aluno, async (req, res) => {
    res.json(await servico.aceitarTermo(ctx, quem(req), versao.parse(req.body).versao));
  });

  r.get('/coordenacao/termo', ...coordenacao, async (req, res) => {
    res.json(await servico.termoDaCoordenacao(ctx, quem(req)));
  });

  r.get('/coordenacao/termo/:versao', ...coordenacao, async (req, res) => {
    res.json(await servico.versaoDoTermo(ctx, quem(req), versao.parse(req.params).versao));
  });

  r.post('/coordenacao/termo', ...coordenacao, async (req, res) => {
    res
      .status(201)
      .json(await servico.publicarTermo(ctx, quem(req), novoTexto.parse(req.body).texto));
  });

  return r;
}
