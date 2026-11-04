import express, { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import * as servico from './servico';

const id = z.object({ id: z.uuid('Identificador inválido') });

/** Mensagens de voz: envio como bytes (até 1 MB) com a duração no cabeçalho X-Duracao-Ms. */
export function rotasAudios(ctx: Contexto) {
  const r = Router();
  const aluno = [autenticar(ctx), exigirPapel('ALUNO')];
  const corpo = express.raw({
    type: () => true,
    limit: servico.TAMANHO_MAXIMO_AUDIO + 1024,
  });

  r.post('/audios', ...aluno, corpo, async (req, res) => {
    const dados = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array();
    const duracao = Number(req.get('x-duracao-ms'));
    res.status(201).json(await servico.enviarAudio(ctx, quem(req), dados, duracao));
  });

  r.get('/audios/:id', async (req, res) => {
    const audio = await servico.lerAudio(ctx, id.parse(req.params).id);
    res
      .type(audio.tipo)
      .set('Cache-Control', 'private, max-age=86400')
      .set('Cross-Origin-Resource-Policy', 'cross-origin')
      .set('Accept-Ranges', 'none')
      .send(Buffer.from(audio.dados));
  });

  return r;
}
