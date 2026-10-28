import { Router } from 'express';
import { z } from 'zod';
import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { autenticar, quem } from '../../seguranca/autenticar';

const filtroDisciplinas = z.object({ cursoId: z.uuid().optional() });

/** Cursos e disciplinas da faculdade de quem está logado. */
export function rotasCatalogo(ctx: Contexto) {
  const r = Router();
  const logado = autenticar(ctx.segredoJwt);

  r.get('/cursos', logado, async (req, res) => {
    const cursos = await naFaculdade(ctx.prisma, quem(req).instituicaoId, (tx) =>
      tx.curso.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    );
    res.json(cursos);
  });

  // Com cursoId: as disciplinas do curso e as comuns a todos os cursos.
  r.get('/disciplinas', logado, async (req, res) => {
    const { cursoId } = filtroDisciplinas.parse(req.query);
    const disciplinas = await naFaculdade(ctx.prisma, quem(req).instituicaoId, (tx) =>
      tx.disciplina.findMany({
        where: cursoId ? { OR: [{ cursoId }, { cursoId: null }] } : {},
        select: { id: true, nome: true, cursoId: true },
        orderBy: { nome: 'asc' },
      }),
    );
    res.json(disciplinas);
  });

  return r;
}
