import express, { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });

/** Foto de perfil (RF06): envio como bytes (Content-Type da imagem), até 1 MB. */
export function rotasFotos(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx);
  const corpoDaImagem = express.raw({
    type: () => true,
    limit: servico.TAMANHO_MAXIMO + 1024,
  });

  r.put('/eu/foto', logado, corpoDaImagem, async (req, res) => {
    const dados = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array();
    res.json(await servico.enviarFoto(ctx, quem(req), dados));
  });

  r.delete('/eu/foto', logado, async (req, res) => {
    await servico.removerFoto(ctx, quem(req));
    res.status(204).end();
  });

  r.get('/fotos/:id', async (req, res) => {
    const foto = await servico.lerFoto(ctx, id.parse(req.params).id);
    res
      .type(foto.tipo)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .set('Cross-Origin-Resource-Policy', 'cross-origin')
      .send(Buffer.from(foto.dados));
  });

  return r;
}
