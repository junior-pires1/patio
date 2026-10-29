import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const idMatch = z.object({ id: z.uuid('Identificador inválido') });
const pagina = z.object({ antes: z.iso.datetime({ offset: true }).optional() });
const novaMensagem = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'Escreva uma mensagem')
    .max(1000, 'No máximo 1.000 caracteres'),
});

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
    const { texto } = novaMensagem.parse(req.body);
    res.status(201).json(await servico.enviarMensagem(ctx, quem(req), id, texto));
  });

  return r;
}
