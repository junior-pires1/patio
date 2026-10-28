import { Router, type RequestHandler } from 'express';
import type { Contexto } from '../../contexto';
import * as esquemas from './esquemas';
import * as servico from './servico';

/** Rotas públicas de conta: código, cadastro, login, renovação e saída. */
export function rotasAuth(ctx: Contexto, limiteCredenciais: RequestHandler) {
  const r = Router();

  r.post('/codigo', limiteCredenciais, async (req, res) => {
    const faculdade = await servico.pedirCodigo(ctx, esquemas.pedirCodigo.parse(req.body));
    res.status(202).json({
      mensagem:
        'Enviamos um código de 6 números para o seu e-mail. Ele vale por 10 minutos.',
      faculdade,
    });
  });

  r.post('/cadastro', limiteCredenciais, async (req, res) => {
    res.status(201).json(await servico.cadastrar(ctx, esquemas.cadastro.parse(req.body)));
  });

  r.post('/login', limiteCredenciais, async (req, res) => {
    res.json(await servico.entrar(ctx, esquemas.login.parse(req.body)));
  });

  r.post('/renovar', async (req, res) => {
    const { refreshToken } = esquemas.renovacao.parse(req.body);
    res.json(await servico.renovar(ctx, refreshToken));
  });

  r.post('/sair', async (req, res) => {
    const { refreshToken } = esquemas.renovacao.parse(req.body);
    await servico.sair(ctx, refreshToken);
    res.status(204).end();
  });

  return r;
}
