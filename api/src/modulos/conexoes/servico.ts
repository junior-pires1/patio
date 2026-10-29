import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { PERFIL_PUBLICO } from '../perfil/servico';
import { calcularAfinidade } from './afinidade';

export const LIMITE_CARTAS = 20;
const CANDIDATOS_ANALISADOS = 300;

/** Colegas que a pessoa pode ver: alunos ativos, sem bloqueio em nenhum sentido. */
export function colegasVisiveis(euId: string): Prisma.UsuarioWhereInput {
  return {
    id: { not: euId },
    papel: 'ALUNO',
    status: 'ATIVA',
    bloqueiosFeitos: { none: { bloqueadoId: euId } },
    bloqueiosRecebidos: { none: { bloqueadorId: euId } },
  };
}

const PERFIL_AFINIDADE = {
  ...PERFIL_PUBLICO,
  cursoId: true,
} satisfies Prisma.UsuarioSelect;

/** Participantes de um match em ordem (usuario_a_id < usuario_b_id). */
export const emOrdem = (x: string, y: string): [string, string] =>
  x < y ? [x, y] : [y, x];

/**
 * RF: cartas de descoberta. Primeiro quem já curtiu a pessoa (assim a
 * curtida recebida vira match logo), depois da maior para a menor afinidade.
 * Ficam de fora quem já foi curtido ou pulado, quem já é conexão e bloqueios.
 */
export function descobrir(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const meu = await tx.usuario.findUniqueOrThrow({
      where: { id: eu.id },
      select: PERFIL_AFINIDADE,
    });
    const candidatos = await tx.usuario.findMany({
      where: {
        ...colegasVisiveis(eu.id),
        curtidasRecebidas: { none: { deId: eu.id } },
        recusasRecebidas: { none: { deId: eu.id } },
        matchesComoA: { none: { usuarioBId: eu.id } },
        matchesComoB: { none: { usuarioAId: eu.id } },
      },
      select: {
        ...PERFIL_AFINIDADE,
        criadoEm: true,
        curtidasFeitas: { where: { paraId: eu.id }, select: { id: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: CANDIDATOS_ANALISADOS,
    });

    return candidatos
      .map(({ cursoId, criadoEm: _criado, curtidasFeitas, ...perfil }) => ({
        ...perfil,
        curtiuVoce: curtidasFeitas.length > 0,
        afinidade: calcularAfinidade(meu, { ...perfil, cursoId }),
      }))
      .sort(
        (a, b) =>
          Number(b.curtiuVoce) - Number(a.curtiuVoce) ||
          b.afinidade.pontos - a.afinidade.pontos,
      )
      .slice(0, LIMITE_CARTAS);
  });
}

async function exigirColega(tx: Transacao, eu: Autenticado, id: string) {
  const alvo = await tx.usuario.findFirst({
    // AND: o filtro de visíveis também tem `id`, e o spread sobrescreveria o alvo.
    where: { AND: [{ id }, colegasVisiveis(eu.id)] },
    select: { id: true },
  });
  if (!alvo) throw naoEncontrado('Perfil não encontrado.');
}

/** Trava o par na transação: duas curtidas simultâneas não criam dois matches. */
async function travarPar(tx: Transacao, x: string, y: string) {
  const [a, b] = emOrdem(x, y);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${a}:${b}`}, 0))`;
}

/**
 * Curtidas recebidas que ainda esperam resposta: quem curtiu a pessoa e
 * ainda não foi curtido de volta nem pulado.
 */
function curtidasPendentes(eu: Autenticado): Prisma.CurtidaWhereInput {
  return {
    paraId: eu.id,
    de: {
      ...colegasVisiveis(eu.id),
      curtidasRecebidas: { none: { deId: eu.id } },
      recusasRecebidas: { none: { deId: eu.id } },
    },
  };
}

/** RF: quantas pessoas curtiram e esperam resposta (para o aviso no app). */
export function contarCurtidasRecebidas(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => ({
    total: await tx.curtida.count({ where: curtidasPendentes(eu) }),
  }));
}

/**
 * RF: curtir. A outra pessoa recebe `curtida:nova` (sem saber quem foi até
 * abrir as cartas). Se ela já tinha curtido, nasce o match e os dois
 * recebem `match:novo` em tempo real.
 */
export async function curtir(ctx: Contexto, eu: Autenticado, paraId: string) {
  const resultado = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirColega(tx, eu, paraId);
    await travarPar(tx, eu.id, paraId);

    const { count: nova } = await tx.curtida.createMany({
      data: [{ instituicaoId: eu.instituicaoId, deId: eu.id, paraId }],
      skipDuplicates: true,
    });
    await tx.recusa.deleteMany({ where: { deId: eu.id, paraId } });

    const reciproca = await tx.curtida.findUnique({
      where: { deId_paraId: { deId: paraId, paraId: eu.id } },
      select: { id: true },
    });
    if (!reciproca) {
      if (nova === 0) return { match: null, novo: false };
      const pendentes = await tx.curtida.count({
        where: curtidasPendentes({ ...eu, id: paraId }),
      });
      return { match: null, novo: false, pendentesDoAlvo: pendentes };
    }

    const [usuarioAId, usuarioBId] = emOrdem(eu.id, paraId);
    const existente = await tx.match.findUnique({
      where: { usuarioAId_usuarioBId: { usuarioAId, usuarioBId } },
    });
    // Match desfeito não volta sozinho: alguém escolheu encerrar a conexão.
    if (existente) return { match: existente.desfeitoEm ? null : existente, novo: false };

    const match = await tx.match.create({
      data: { instituicaoId: eu.instituicaoId, usuarioAId, usuarioBId },
    });
    return { match, novo: true };
  });

  if (resultado.novo && resultado.match) {
    ctx.notificar.enviar([eu.id, paraId], 'match:novo', { matchId: resultado.match.id });
  }
  if ('pendentesDoAlvo' in resultado) {
    ctx.notificar.enviar([paraId], 'curtida:nova', { total: resultado.pendentesDoAlvo });
  }
  return { match: resultado.match ? { id: resultado.match.id } : null };
}

/** RF: pular (recusar) um perfil. A carta não aparece de novo. */
export function pular(ctx: Contexto, eu: Autenticado, paraId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirColega(tx, eu, paraId);
    await tx.recusa.createMany({
      data: [{ instituicaoId: eu.instituicaoId, deId: eu.id, paraId }],
      skipDuplicates: true,
    });
  });
}

const CONTATOS_E_PERFIL = {
  ...PERFIL_PUBLICO,
  contatos: true,
} satisfies Prisma.UsuarioSelect;

/** RF: minhas conexões ativas, com a última mensagem e quantas não li. */
export function listarMatches(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const matches = await tx.match.findMany({
      where: { desfeitoEm: null, OR: [{ usuarioAId: eu.id }, { usuarioBId: eu.id }] },
      include: {
        usuarioA: { select: CONTATOS_E_PERFIL },
        usuarioB: { select: CONTATOS_E_PERFIL },
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
        _count: {
          select: { mensagens: { where: { autorId: { not: eu.id }, lidaEm: null } } },
        },
      },
    });
    return matches
      .map((m) => ({
        id: m.id,
        criadoEm: m.criadoEm,
        // Depois do match, os contatos opcionais ficam visíveis (RN).
        pessoa: m.usuarioAId === eu.id ? m.usuarioB : m.usuarioA,
        ultimaMensagem: m.mensagens[0] ?? null,
        naoLidas: m._count.mensagens,
      }))
      .sort((x, y) => atividade(y) - atividade(x));
  });
}

const atividade = (m: { criadoEm: Date; ultimaMensagem: { criadoEm: Date } | null }) =>
  (m.ultimaMensagem?.criadoEm ?? m.criadoEm).getTime();

/** Match ativo do qual a pessoa participa; senão 404. */
export async function exigirMatch(tx: Transacao, eu: Autenticado, matchId: string) {
  const match = await tx.match.findFirst({
    where: {
      id: matchId,
      desfeitoEm: null,
      OR: [{ usuarioAId: eu.id }, { usuarioBId: eu.id }],
    },
  });
  if (!match) throw naoEncontrado('Conversa não encontrada.');
  return {
    ...match,
    outroId: match.usuarioAId === eu.id ? match.usuarioBId : match.usuarioAId,
  };
}

/** RF: desfazer a conexão. A conversa some para os dois. */
export async function desfazer(ctx: Contexto, eu: Autenticado, matchId: string) {
  const match = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const m = await exigirMatch(tx, eu, matchId);
    await tx.match.update({ where: { id: m.id }, data: { desfeitoEm: new Date() } });
    return m;
  });
  ctx.notificar.enviar([match.outroId], 'match:desfeito', { matchId });
}
