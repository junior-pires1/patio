import type { z } from 'zod';
import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import type * as esquemas from './esquemas';

const DISCIPLINAS = {
  select: { relacao: true, disciplina: { select: { id: true, nome: true } } },
  orderBy: { disciplina: { nome: 'asc' } },
} satisfies Prisma.Usuario$disciplinasArgs;

/** O que a própria pessoa vê do seu perfil. Hash da senha e nascimento nunca saem. */
export const PERFIL_PROPRIO = {
  id: true,
  instituicaoId: true,
  papel: true,
  nome: true,
  apelido: true,
  email: true,
  semestre: true,
  turno: true,
  frase: true,
  sobre: true,
  fotoUrl: true,
  objetivos: true,
  interesses: true,
  habilidades: true,
  horariosLivres: true,
  contatos: true,
  status: true,
  criadoEm: true,
  curso: { select: { id: true, nome: true } },
  instituicao: { select: { id: true, nome: true, sigla: true, corPrimaria: true } },
  disciplinas: DISCIPLINAS,
} satisfies Prisma.UsuarioSelect;

/** O que os colegas da mesma faculdade veem (sem e-mail e sem contatos). */
export const PERFIL_PUBLICO = {
  id: true,
  apelido: true,
  semestre: true,
  turno: true,
  frase: true,
  sobre: true,
  fotoUrl: true,
  objetivos: true,
  interesses: true,
  habilidades: true,
  horariosLivres: true,
  curso: { select: { id: true, nome: true } },
  disciplinas: DISCIPLINAS,
} satisfies Prisma.UsuarioSelect;

export function meuPerfil(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.usuario.findUniqueOrThrow({ where: { id: eu.id }, select: PERFIL_PROPRIO }),
  );
}

export function atualizarPerfil(
  ctx: Contexto,
  eu: Autenticado,
  dados: z.infer<typeof esquemas.atualizarPerfil>,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (dados.cursoId && !(await tx.curso.findUnique({ where: { id: dados.cursoId } }))) {
      throw new ErroApp(422, 'curso_inexistente', 'Curso não encontrado.', {
        cursoId: 'Curso não encontrado',
      });
    }
    return tx.usuario.update({ where: { id: eu.id }, data: dados, select: PERFIL_PROPRIO });
  });
}

/** Substitui a lista de disciplinas da pessoa (cursando, posso ajudar, preciso de ajuda). */
export function definirDisciplinas(
  ctx: Contexto,
  eu: Autenticado,
  { itens }: z.infer<typeof esquemas.disciplinas>,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const ids = [...new Set(itens.map((i) => i.disciplinaId))];
    const existentes = await tx.disciplina.count({ where: { id: { in: ids } } });
    if (existentes !== ids.length) {
      throw new ErroApp(
        422,
        'disciplina_inexistente',
        'Alguma disciplina não foi encontrada.',
      );
    }
    await tx.usuarioDisciplina.deleteMany({ where: { usuarioId: eu.id } });
    await tx.usuarioDisciplina.createMany({
      data: itens.map((i) => ({ ...i, instituicaoId: eu.instituicaoId, usuarioId: eu.id })),
      skipDuplicates: true,
    });
    return tx.usuario.findUniqueOrThrow({ where: { id: eu.id }, select: PERFIL_PROPRIO });
  });
}

/**
 * Perfil de um colega. Outra faculdade, conta inativa ou bloqueio em qualquer
 * sentido dão a mesma resposta: 404 (não revelamos que a conta existe).
 */
export async function perfilDeColega(ctx: Contexto, eu: Autenticado, id: string) {
  const perfil = await naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.usuario.findFirst({
      where: {
        id,
        status: 'ATIVA',
        papel: 'ALUNO',
        bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
        bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
      },
      select: PERFIL_PUBLICO,
    }),
  );
  if (!perfil) throw naoEncontrado('Perfil não encontrado.');
  return perfil;
}
