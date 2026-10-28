import { z } from 'zod';

const lista = (max: number, tamanho = 40) =>
  z.array(z.string().trim().min(1).max(tamanho)).max(max, `No máximo ${max} itens`);

// Formato dia-período, como ter-noite (RN do relatório).
const horario = z
  .string()
  .regex(
    /^(seg|ter|qua|qui|sex|sab|dom)-(manha|tarde|noite)$/,
    'Use o formato dia-período, como ter-noite',
  );

const textoOpcional = (max: number) => z.string().trim().max(max).nullable().optional();

export const atualizarPerfil = z
  .object({
    apelido: z.string().trim().min(1).max(40).optional(),
    cursoId: z.uuid().nullable().optional(),
    semestre: z.number().int().min(1).max(12).nullable().optional(),
    turno: z.enum(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL']).nullable().optional(),
    frase: textoOpcional(140),
    sobre: textoOpcional(1000),
    fotoUrl: z
      .url({ protocol: /^https$/ })
      .max(300)
      .nullable()
      .optional(),
    objetivos: lista(6),
    interesses: lista(15),
    habilidades: lista(15),
    horariosLivres: z.array(horario).max(21).optional(),
    contatos: z
      .object({
        whatsapp: z.string().trim().max(20).optional(),
        instagram: z.string().trim().max(40).optional(),
        linkedin: z.string().trim().max(120).optional(),
      })
      .strict()
      .optional(),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Envie pelo menos um campo para alterar');

export const disciplinas = z.object({
  itens: z
    .array(
      z.object({
        disciplinaId: z.uuid(),
        relacao: z.enum(['CURSANDO', 'POSSO_AJUDAR', 'PRECISO_AJUDA']),
      }),
    )
    .max(60, 'No máximo 60 itens'),
});

export const idDoColega = z.object({ id: z.uuid('Identificador inválido') });
