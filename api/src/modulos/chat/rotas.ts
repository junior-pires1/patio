import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import { novaMensagemConversa } from '../imagens/esquemas';
import * as servico from './servico';

const idMatch = z.object({ id: z.uuid('Identificador inválido') });
const pagina = z.object({ antes: z.iso.datetime({ offset: true }).optional() });

/** Chat das conexões. O envio é por REST; a entrega instantânea, por Socket.IO. */
export function rotasChat(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];

  r.get('/matches/:id/mensagens', ...aluno, async (req, res) => {
    const { id } = idMatch.parse(req.params);
    const { antes } = pagina.parse(req.query);
    res.json(
      await servico.listarMensagens(
        ctx,
        quem(req),
        id,
        antes ? new Date(antes) : undefined,
      ),
    );
  });

  r.post('/matches/:id/mensagens', ...aluno, async (req, res) => {
    const { id } = idMatch.parse(req.params);
    res
      .status(201)
      .json(
        await servico.enviarMensagem(
          ctx,
          quem(req),
          id,
          novaMensagemConversa.parse(req.body),
        ),
      );
  });

  const idMensagem = z.object({ id: z.uuid('Identificador inválido') });
  const reacao = z.object({ reacao: z.enum(servico.REACOES, 'Reação inválida') });

  r.post('/matches/:id/digitando', ...aluno, async (req, res) => {
    await servico.digitando(ctx, quem(req), idMatch.parse(req.params).id);
    res.status(204).end();
  });

  r.put('/mensagens/:id/reacao', ...aluno, async (req, res) => {
    const { id } = idMensagem.parse(req.params);
    res.json(await servico.reagir(ctx, quem(req), id, reacao.parse(req.body).reacao));
  });
  r.delete('/mensagens/:id/reacao', ...aluno, async (req, res) => {
    res.json(await servico.reagir(ctx, quem(req), idMensagem.parse(req.params).id, null));
  });

  r.delete('/mensagens/:id', ...aluno, async (req, res) => {
    res.json(await servico.apagarMensagem(ctx, quem(req), idMensagem.parse(req.params).id));
  });

  return r;
}
