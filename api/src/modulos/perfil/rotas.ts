import { Router } from 'express';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';
import * as esquemas from './esquemas';
import * as servico from './servico';

export function rotasPerfil(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx.segredoJwt);

  r.get('/eu', logado, async (req, res) => {
    res.json(await servico.meuPerfil(ctx, quem(req)));
  });

  r.patch('/eu', logado, async (req, res) => {
    const dados = esquemas.atualizarPerfil.parse(req.body);
    res.json(await servico.atualizarPerfil(ctx, quem(req), dados));
  });

  r.put('/eu/disciplinas', logado, async (req, res) => {
    const dados = esquemas.disciplinas.parse(req.body);
    res.json(await servico.definirDisciplinas(ctx, quem(req), dados));
  });

  r.get('/usuarios/:id', logado, async (req, res) => {
    const { id } = esquemas.idDoColega.parse(req.params);
    res.json(await servico.perfilDeColega(ctx, quem(req), id));
  });

  return r;
}
