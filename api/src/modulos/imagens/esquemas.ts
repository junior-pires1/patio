import { z } from 'zod';

/** Mensagem de conversa ou de grupo: texto, imagem ou os dois. */
export const novaMensagem = z
  .object({
    texto: z.string().trim().max(1000, 'No máximo 1.000 caracteres').default(''),
    imagemId: z.uuid('Imagem inválida').optional(),
  })
  .refine((m) => m.texto.length > 0 || m.imagemId, {
    message: 'Escreva uma mensagem',
    path: ['texto'],
  });

export type NovaMensagem = z.infer<typeof novaMensagem>;
