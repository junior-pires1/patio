import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';

export const MENSAGENS_POR_PAGINA = 50;

const RESUMO = {
  id: true,
  nome: true,
  descricao: true,
  encontro: true,
  local: true,
  vagas: true,
  criadoEm: true,
  disciplina: { select: { id: true, nome: true } },
  criador: { select: { id: true, apelido: true } },
  _count: { select: { membros: true } },
} satisfies Prisma.GrupoEstudoSelect;

type Resumo = Prisma.GrupoEstudoGetPayload<{ select: typeof RESUMO }>;

function formatar(
  { _count, ...g }: Resumo,
  membro: { lidoAte: Date | null } | undefined,
  naoLidas = 0,
) {
  return {
    ...g,
    membros: _count.membros,
    vagasLivres: g.vagas - _count.membros,
    souMembro: Boolean(membro),
    naoLidas,
  };
}

/** RF22/RF23: grupos da faculdade; `meus` mostra só onde a pessoa é membro. */
export function listarGrupos(
  ctx: Contexto,
  eu: Autenticado,
  filtro: { disciplinaId?: string; meus?: boolean },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const grupos = await tx.grupoEstudo.findMany({
      where: {
        ...(filtro.disciplinaId ? { disciplinaId: filtro.disciplinaId } : {}),
        ...(filtro.meus ? { membros: { some: { usuarioId: eu.id } } } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: {
        ...RESUMO,
        membros: { where: { usuarioId: eu.id }, select: { lidoAte: true } },
      },
    });
    // Mensagens novas nos grupos em que a pessoa está (depois do que ela já leu).
    return Promise.all(
      grupos.map(async ({ membros, ...g }) => {
        const membro = membros[0];
        const naoLidas = membro
          ? await tx.grupoMensagem.count({
              where: {
                grupoId: g.id,
                autorId: { not: eu.id },
                ...(membro.lidoAte ? { criadoEm: { gt: membro.lidoAte } } : {}),
              },
            })
          : 0;
        return formatar(g, membro, naoLidas);
      }),
    );
  });
}

async function exigirGrupo(tx: Transacao, grupoId: string) {
  const grupo = await tx.grupoEstudo.findUnique({ where: { id: grupoId }, select: RESUMO });
  if (!grupo) throw naoEncontrado('Grupo não encontrado.');
  return grupo;
}

async function exigirMembro(tx: Transacao, eu: Autenticado, grupoId: string) {
  await exigirGrupo(tx, grupoId);
  const membro = await tx.grupoMembro.findUnique({
    where: { grupoId_usuarioId: { grupoId, usuarioId: eu.id } },
  });
  if (!membro) throw new ErroApp(403, 'nao_e_membro', 'Entre no grupo para ver o chat.');
  return membro;
}

/** Detalhes do grupo com a lista de membros. */
export function verGrupo(ctx: Contexto, eu: Autenticado, grupoId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const grupo = await exigirGrupo(tx, grupoId);
    const membros = await tx.grupoMembro.findMany({
      where: { grupoId },
      orderBy: [{ papel: 'asc' }, { entrouEm: 'asc' }],
      select: {
        papel: true,
        entrouEm: true,
        usuario: { select: { id: true, apelido: true, fotoUrl: true } },
      },
    });
    const participacao = membros.find((m) => m.usuario.id === eu.id);
    return {
      ...formatar(grupo, participacao ? { lidoAte: null } : undefined),
      listaDeMembros: membros,
    };
  });
}

/** RF22: criar grupo; quem cria entra como CRIADOR. */
export function criarGrupo(
  ctx: Contexto,
  eu: Autenticado,
  dados: {
    nome: string;
    descricao?: string;
    disciplinaId?: string;
    encontro?: string;
    local?: string;
    vagas: number;
  },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (
      dados.disciplinaId &&
      !(await tx.disciplina.findUnique({ where: { id: dados.disciplinaId } }))
    ) {
      throw new ErroApp(422, 'disciplina_inexistente', 'Disciplina não encontrada.', {
        disciplinaId: 'Disciplina não encontrada',
      });
    }
    const grupo = await tx.grupoEstudo.create({
      data: { ...dados, instituicaoId: eu.instituicaoId, criadorId: eu.id },
    });
    await tx.grupoMembro.create({
      data: {
        instituicaoId: eu.instituicaoId,
        grupoId: grupo.id,
        usuarioId: eu.id,
        papel: 'CRIADOR',
      },
    });
    return formatar(await exigirGrupo(tx, grupo.id), { lidoAte: null });
  });
}

/** RF23: entrar no grupo, respeitando as vagas (o gatilho do banco garante o limite). */
export function entrar(ctx: Contexto, eu: Autenticado, grupoId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirGrupo(tx, grupoId);
    const ja = await tx.grupoMembro.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: eu.id } },
    });
    if (!ja) {
      await tx.grupoMembro.create({
        data: { instituicaoId: eu.instituicaoId, grupoId, usuarioId: eu.id },
      });
    }
    return formatar(await exigirGrupo(tx, grupoId), { lidoAte: null });
  });
}

/**
 * RF23: sair do grupo. Se quem sai é o criador, o membro mais antigo passa
 * a ser o criador; se ninguém fica, o grupo é apagado.
 */
export function sair(ctx: Contexto, eu: Autenticado, grupoId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const membro = await exigirMembro(tx, eu, grupoId);
    await tx.grupoMembro.delete({
      where: { grupoId_usuarioId: { grupoId, usuarioId: eu.id } },
    });
    const proximo = await tx.grupoMembro.findFirst({
      where: { grupoId },
      orderBy: { entrouEm: 'asc' },
    });
    if (!proximo) {
      await tx.grupoEstudo.delete({ where: { id: grupoId } });
      return { grupoApagado: true };
    }
    if (membro.papel === 'CRIADOR') {
      await tx.grupoMembro.update({
        where: { grupoId_usuarioId: { grupoId, usuarioId: proximo.usuarioId } },
        data: { papel: 'CRIADOR' },
      });
      await tx.grupoEstudo.update({
        where: { id: grupoId },
        data: { criadorId: proximo.usuarioId },
      });
    }
    return { grupoApagado: false };
  });
}

/** RF24: mensagens do grupo (só membros). Abrir marca como lidas. */
export function listarMensagens(
  ctx: Contexto,
  eu: Autenticado,
  grupoId: string,
  antes?: Date,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirMembro(tx, eu, grupoId);
    const pagina = await tx.grupoMensagem.findMany({
      where: { grupoId, ...(antes ? { criadoEm: { lt: antes } } : {}) },
      orderBy: { criadoEm: 'desc' },
      take: MENSAGENS_POR_PAGINA,
      select: {
        id: true,
        texto: true,
        criadoEm: true,
        autor: { select: { id: true, apelido: true } },
      },
    });
    await tx.grupoMembro.update({
      where: { grupoId_usuarioId: { grupoId, usuarioId: eu.id } },
      data: { lidoAte: new Date() },
    });
    return { mensagens: pagina.reverse(), temMais: pagina.length === MENSAGENS_POR_PAGINA };
  });
}

/** RF24: enviar mensagem; todos os membros recebem `grupo:mensagem` em tempo real. */
export async function enviarMensagem(
  ctx: Contexto,
  eu: Autenticado,
  grupoId: string,
  texto: string,
) {
  const { mensagem, membros } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      await exigirMembro(tx, eu, grupoId);
      const criada = await tx.grupoMensagem.create({
        data: { instituicaoId: eu.instituicaoId, grupoId, autorId: eu.id, texto },
        select: {
          id: true,
          texto: true,
          criadoEm: true,
          autor: { select: { id: true, apelido: true } },
        },
      });
      const todos = await tx.grupoMembro.findMany({
        where: { grupoId },
        select: { usuarioId: true },
      });
      return { mensagem: criada, membros: todos.map((m) => m.usuarioId) };
    },
  );
  ctx.notificar.enviar(membros, 'grupo:mensagem', { grupoId, mensagem });
  return mensagem;
}
