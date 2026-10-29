import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { email } from '../auth/esquemas';
import { adminDe, autenticarPlataforma } from './acesso';
import * as servico from './servico';

const login = z.object({ email, senha: z.string().min(1).max(72) });
const dominio = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    'Domínio inválido (ex.: aluno.faculdade.edu.br)',
  );
const novaFaculdade = z.object({
  nome: z.string().trim().min(3).max(120),
  sigla: z.string().trim().min(2).max(20),
  corPrimaria: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Use o formato #RRGGBB')
    .default('#1F6FEB'),
  cidade: z.string().trim().min(2).max(80),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a sigla do estado, ex.: SP'),
  dominios: z.array(dominio).min(1, 'Informe pelo menos um domínio').max(10),
  coordenacao: z.object({ nome: z.string().trim().min(3).max(120), email }),
});
const id = z.object({ id: z.uuid('Identificador inválido') });
const ativacao = z.object({ ativa: z.boolean() });

/** Painel da equipe da plataforma (RF34–RF37). */
export function rotasPlataforma(ctx: Contexto, limiteCredenciais: RequestHandler) {
  const r = Router();
  const admin = autenticarPlataforma(ctx);

  r.post('/plataforma/login', limiteCredenciais, async (req, res) => {
    const dados = login.parse(req.body);
    res.json(await servico.entrar(ctx, dados.email, dados.senha));
  });

  r.get('/plataforma/metricas', admin, async (_req, res) => {
    res.json(await servico.metricas(ctx));
  });

  r.get('/plataforma/faculdades', admin, async (_req, res) => {
    res.json(await servico.listarFaculdades(ctx));
  });

  r.post('/plataforma/faculdades', admin, async (req, res) => {
    res
      .status(201)
      .json(
        await servico.cadastrarFaculdade(ctx, adminDe(req), novaFaculdade.parse(req.body)),
      );
  });

  r.patch('/plataforma/faculdades/:id', admin, async (req, res) => {
    const { ativa } = ativacao.parse(req.body);
    res.json(
      await servico.mudarAtivacao(ctx, adminDe(req), id.parse(req.params).id, ativa),
    );
  });

  return r;
}
