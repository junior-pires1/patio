import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { avisar, notificar } from '../notificacoes/servico';
import { PERFIL_PUBLICO } from '../perfil/servico';
import { calcularAfinidade } from './afinidade';
import { urlDaImagem } from '../imagens/servico';

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
export type FiltroDescobrir = {
  objetivo?: string;
  ajudaEm?: string;
  cursoId?: string;
  turno?: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
  semestreMin?: number;
  semestreMax?: number;
};

/** Super curtidas por pessoa a cada 24 horas. */
export const SUPER_POR_DIA = 3;

export function descobrir(ctx: Contexto, eu: Autenticado, filtro: FiltroDescobrir = {}) {
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
        // RF09: filtros opcionais por objetivo e por quem pode ajudar numa disciplina
        ...(filtro.objetivo ? { objetivos: { has: filtro.objetivo } } : {}),
        ...(filtro.ajudaEm
          ? {
              disciplinas: {
                some: { disciplinaId: filtro.ajudaEm, relacao: 'POSSO_AJUDAR' },
              },
            }
          : {}),
        ...(filtro.cursoId ? { cursoId: filtro.cursoId } : {}),
        ...(filtro.turno ? { turno: filtro.turno } : {}),
        ...(filtro.semestreMin || filtro.semestreMax
          ? {
              semestre: {
                ...(filtro.semestreMin ? { gte: filtro.semestreMin } : {}),
                ...(filtro.semestreMax ? { lte: filtro.semestreMax } : {}),
              },
            }
          : {}),
      },
      select: {
        ...PERFIL_AFINIDADE,
        criadoEm: true,
        curtidasFeitas: { where: { paraId: eu.id }, select: { id: true, super: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: CANDIDATOS_ANALISADOS,
    });

    return candidatos
      .map(({ cursoId, criadoEm: _criado, curtidasFeitas, ...perfil }) => ({
        ...perfil,
        curtiuVoce: curtidasFeitas.length > 0,
        superCurtiuVoce: curtidasFeitas.some((c) => c.super),
        afinidade: calcularAfinidade(meu, { ...perfil, cursoId }),
      }))
      .sort(
        (a, b) =>
          Number(b.superCurtiuVoce) - Number(a.superCurtiuVoce) ||
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
export async function curtir(
  ctx: Contexto,
  eu: Autenticado,
  paraId: string,
  superCurtida = false,
) {
  const resultado = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirColega(tx, eu, paraId);
    await travarPar(tx, eu.id, paraId);

    let avisosSuper: Awaited<ReturnType<typeof notificar>> = [];
    if (superCurtida) {
      const existente = await tx.curtida.findUnique({
        where: { deId_paraId: { deId: eu.id, paraId } },
        select: { super: true },
      });
      if (!existente?.super) {
        const usadas = await tx.curtida.count({
          where: {
            deId: eu.id,
            super: true,
            criadoEm: { gte: new Date(Date.now() - 86_400_000) },
          },
        });
        if (usadas >= SUPER_POR_DIA) {
          throw new ErroApp(
            429,
            'limite_super',
            `Você já usou as ${SUPER_POR_DIA} super curtidas de hoje. Amanhã tem mais.`,
          );
        }
        // Super curtida conta a partir de agora (e vale também como curtida comum).
        await tx.curtida.upsert({
          where: { deId_paraId: { deId: eu.id, paraId } },
          create: { instituicaoId: eu.instituicaoId, deId: eu.id, paraId, super: true },
          update: { super: true, criadoEm: new Date() },
        });
        // Na super curtida a pessoa fica sabendo na hora quem foi.
        avisosSuper = await notificar(tx, eu, [{ para: paraId, tipo: 'SUPER_CURTIDA' }]);
      }
    }
    const { count: nova } = superCurtida
      ? { count: avisosSuper.length > 0 ? 1 : 0 }
      : await tx.curtida.createMany({
          data: [{ instituicaoId: eu.instituicaoId, deId: eu.id, paraId }],
          skipDuplicates: true,
        });
    await tx.recusa.deleteMany({ where: { deId: eu.id, paraId } });

    const reciproca = await tx.curtida.findUnique({
      where: { deId_paraId: { deId: paraId, paraId: eu.id } },
      select: { id: true },
    });
    if (!reciproca) {
      if (nova === 0) return { match: null, novo: false, avisos: avisosSuper };
      const pendentes = await tx.curtida.count({
        where: curtidasPendentes({ ...eu, id: paraId }),
      });
      return { match: null, novo: false, pendentesDoAlvo: pendentes, avisos: avisosSuper };
    }

    const [usuarioAId, usuarioBId] = emOrdem(eu.id, paraId);
    const existente = await tx.match.findUnique({
      where: { usuarioAId_usuarioBId: { usuarioAId, usuarioBId } },
    });
    // Match desfeito não volta sozinho: alguém escolheu encerrar a conexão.
    if (existente)
      return {
        match: existente.desfeitoEm ? null : existente,
        novo: false,
        avisos: avisosSuper,
      };

    const match = await tx.match.create({
      data: { instituicaoId: eu.instituicaoId, usuarioAId, usuarioBId },
    });
    const avisos = await notificar(tx, eu, [
      { para: paraId, tipo: 'CONEXAO_NOVA', matchId: match.id },
    ]);
    return { match, novo: true, avisos: [...avisosSuper, ...avisos] };
  });
  if ('avisos' in resultado && resultado.avisos) avisar(ctx, resultado.avisos);

  if (resultado.novo && resultado.match) {
    ctx.notificar.enviar([eu.id, paraId], 'match:novo', { matchId: resultado.match.id });
  }
  if ('pendentesDoAlvo' in resultado) {
    ctx.notificar.enviar([paraId], 'curtida:nova', { total: resultado.pendentesDoAlvo });
  }
  return { match: resultado.match ? { id: resultado.match.id } : null };
}

/** Quantas super curtidas ainda dá para usar nas últimas 24 horas. */
export function superCurtidasRestantes(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const usadas = await tx.curtida.count({
      where: {
        deId: eu.id,
        super: true,
        criadoEm: { gte: new Date(Date.now() - 86_400_000) },
      },
    });
    return { restantes: Math.max(0, SUPER_POR_DIA - usadas), porDia: SUPER_POR_DIA };
  });
}

/**
 * Desfaz o último "pular" (das últimas 24 horas): a carta volta para a pilha.
 * Devolve quem voltou para o app mostrar de novo.
 */
export function desfazerPulo(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const ultima = await tx.recusa.findFirst({
      where: { deId: eu.id, criadoEm: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, paraId: true },
    });
    if (!ultima)
      throw new ErroApp(404, 'nada_para_desfazer', 'Não há nenhum pulo para desfazer.');
    await tx.recusa.delete({ where: { id: ultima.id } });
    return { paraId: ultima.paraId };
  });
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
        ultimaMensagem: m.mensagens[0] ? formatarMensagem(m.mensagens[0]) : null,
        naoLidas: m._count.mensagens,
      }))
      .sort((x, y) => atividade(y) - atividade(x));
  });
}

const formatarMensagem = <
  M extends {
    imagemId: string | null;
    texto: string;
    audioId: string | null;
    postId: string | null;
    apagadaEm: Date | null;
  },
>({
  imagemId,
  ...m
}: M) => ({
  ...m,
  texto: m.apagadaEm ? '' : m.texto,
  imagemUrl: m.apagadaEm ? null : urlDaImagem(imagemId),
  // Prévia na lista de conversas.
  resumo: m.apagadaEm
    ? 'Mensagem apagada'
    : m.texto ||
      (m.audioId
        ? 'Mensagem de voz'
        : imagemId
          ? 'Foto'
          : m.postId
            ? 'Enviou uma publicação'
            : ''),
});

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
