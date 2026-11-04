import express, { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';
import { TAMANHO_MAXIMO } from '../fotos/servico';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });

/** Imagens de publicações e conversas: envio como bytes (até 1 MB) e leitura pelo id. */
export function rotasImagens(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const corpoDaImagem = express.raw({ type: () => true, limit: TAMANHO_MAXIMO + 1024 });

  r.post('/imagens', logado, corpoDaImagem, async (req, res) => {
    const dados = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array();
    res.status(201).json(await servico.enviarImagem(ctx, quem(req), dados));
  });

  r.get('/imagens/:id', async (req, res) => {
    const imagem = await servico.lerImagem(ctx, id.parse(req.params).id);
    res
      .type(imagem.tipo)
      .set('Cache-Control', 'private, max-age=86400')
      .set('Cross-Origin-Resource-Policy', 'cross-origin')
      .send(Buffer.from(imagem.dados));
  });

  return r;
}
