import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { registrar } from './auditoria';

const POR_PAGINA = 20;
const DIAS_DO_RESUMO = 7;

const PESSOA = {
  id: true,
  nome: true,
  apelido: true,
  email: true,
  status: true,
  advertencias: true,
} satisfies Prisma.UsuarioSelect;

/** RF29: indicadores da faculdade e disciplinas em que os alunos pedem ajuda. */
export function resumo(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const desde = new Date(Date.now() - DIAS_DO_RESUMO * 86_400_000);
    const [
      ativos,
      suspensos,
      novos,
      conexoes,
      mensagens,
      denunciasAbertas,
      pedidos,
      ofertas,
    ] = await Promise.all([
      tx.usuario.count({ where: { papel: 'ALUNO', status: 'ATIVA' } }),
      tx.usuario.count({ where: { papel: 'ALUNO', status: 'SUSPENSA' } }),
      tx.usuario.count({ where: { papel: 'ALUNO', criadoEm: { gte: desde } } }),
      tx.match.count({ where: { desfeitoEm: null } }),
      tx.mensagem.count({ where: { criadoEm: { gte: desde } } }),
      tx.denuncia.count({ where: { status: 'ABERTA' } }),
      tx.usuarioDisciplina.groupBy({
        by: ['disciplinaId'],
        where: { relacao: 'PRECISO_AJUDA' },
        _count: { _all: true },
      }),
      tx.usuarioDisciplina.groupBy({
        by: ['disciplinaId'],
        where: { relacao: 'POSSO_AJUDAR' },
        _count: { _all: true },
      }),
    ]);

    const nomes = new Map(
      (
        await tx.disciplina.findMany({
          where: { id: { in: pedidos.map((p) => p.disciplinaId) } },
          select: { id: true, nome: true },
        })
      ).map((d) => [d.id, d.nome]),
    );
    const oferta = new Map(ofertas.map((o) => [o.disciplinaId, o._count._all]));
    const disciplinasComPedidos = pedidos
      .map((p) => ({
        disciplinaId: p.disciplinaId,
        nome: nomes.get(p.disciplinaId) ?? '—',
        precisamDeAjuda: p._count._all,
        podemAjudar: oferta.get(p.disciplinaId) ?? 0,
      }))
      .sort((a, b) => b.precisamDeAjuda - a.precisamDeAjuda || a.nome.localeCompare(b.nome))
      .slice(0, 10);

    return {
      periodoEmDias: DIAS_DO_RESUMO,
      alunos: { ativos, suspensos, novosNoPeriodo: novos },
      conexoesAtivas: conexoes,
      mensagensNoPeriodo: mensagens,
      denunciasAbertas,
      disciplinasComPedidos,
    };
  });
}

/** RF30: fila de denúncias (abertas primeiro, as mais antigas no topo). */
export function listarDenuncias(
  ctx: Contexto,
  eu: Autenticado,
  filtro: { status: 'ABERTA' | 'RESOLVIDA'; pagina: number },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const where = { status: filtro.status };
    const [total, itens] = await Promise.all([
      tx.denuncia.count({ where }),
      tx.denuncia.findMany({
        where,
        orderBy: { criadoEm: filtro.status === 'ABERTA' ? 'asc' : 'desc' },
        skip: (filtro.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          motivo: true,
          detalhe: true,
          status: true,
          acao: true,
          criadoEm: true,
          resolvidaEm: true,
          denunciante: { select: PESSOA },
          denunciado: {
            select: {
              ...PESSOA,
              _count: { select: { denunciasRecebidas: true } },
            },
          },
          resolvidaPor: { select: { id: true, nome: true } },
        },
      }),
    ]);
    return {
      total,
      pagina: filtro.pagina,
      porPagina: POR_PAGINA,
      itens: itens.map(({ denunciado: { _count, ...denunciado }, ...d }) => ({
        ...d,
        denunciado: { ...denunciado, totalDeDenuncias: _count.denunciasRecebidas },
      })),
    };
  });
}

/** Suspende a conta e encerra todas as sessões (RN16). */
async function suspenderNaTransacao(tx: Transacao, usuarioId: string) {
  await tx.usuario.update({ where: { id: usuarioId }, data: { status: 'SUSPENSA' } });
  await tx.sessao.updateMany({
    where: { usuarioId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/** RF30 / RN15: decide a denúncia — arquivar, advertir ou suspender. */
export function decidirDenuncia(
  ctx: Contexto,
  eu: Autenticado,
  denunciaId: string,
  acao: 'ARQUIVADA' | 'ADVERTENCIA' | 'SUSPENSAO',
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const denuncia = await tx.denuncia.findUnique({ where: { id: denunciaId } });
    if (!denuncia) throw naoEncontrado('Denúncia não encontrada.');
    if (denuncia.status === 'RESOLVIDA') {
      throw new ErroApp(409, 'ja_resolvida', 'Esta denúncia já foi resolvida.');
    }

    if (acao === 'ADVERTENCIA') {
      await tx.usuario.update({
        where: { id: denuncia.denunciadoId },
        data: { advertencias: { increment: 1 } },
      });
    }
    if (acao === 'SUSPENSAO') await suspenderNaTransacao(tx, denuncia.denunciadoId);

    const resolvida = await tx.denuncia.update({
      where: { id: denunciaId },
      data: { status: 'RESOLVIDA', acao, resolvidaPorId: eu.id, resolvidaEm: new Date() },
      select: { id: true, status: true, acao: true, resolvidaEm: true },
    });
    await registrar(
      tx,
      eu,
      `denuncia_${acao.toLowerCase()}`,
      { tipo: 'denuncia', id: denunciaId },
      { denunciadoId: denuncia.denunciadoId, motivo: denuncia.motivo },
    );
    return resolvida;
  });
}

/** RF31: busca de alunos por nome, apelido ou e-mail. */
export function listarAlunos(
  ctx: Contexto,
  eu: Autenticado,
  filtro: { busca?: string; status?: 'ATIVA' | 'SUSPENSA'; pagina: number },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const where: Prisma.UsuarioWhereInput = {
      papel: 'ALUNO',
      status: filtro.status ?? { in: ['ATIVA', 'SUSPENSA'] },
      ...(filtro.busca
        ? {
            OR: (['nome', 'apelido', 'email'] as const).map((campo) => ({
              [campo]: { contains: filtro.busca, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const [total, itens] = await Promise.all([
      tx.usuario.count({ where }),
      tx.usuario.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (filtro.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          ...PESSOA,
          semestre: true,
          criadoEm: true,
          curso: { select: { nome: true } },
          _count: { select: { denunciasRecebidas: true } },
        },
      }),
    ]);
    return {
      total,
      pagina: filtro.pagina,
      porPagina: POR_PAGINA,
      itens: itens.map(({ _count, ...a }) => ({
        ...a,
        totalDeDenuncias: _count.denunciasRecebidas,
      })),
    };
  });
}

async function exigirAluno(tx: Transacao, id: string) {
  const aluno = await tx.usuario.findFirst({
    where: { id, papel: 'ALUNO' },
    select: PESSOA,
  });
  if (!aluno) throw naoEncontrado('Aluno não encontrado.');
  return aluno;
}

/** RF31 / RN16: suspender a conta (encerra as sessões) ou reativar. */
export function mudarStatusDoAluno(
  ctx: Contexto,
  eu: Autenticado,
  alunoId: string,
  novo: 'SUSPENSA' | 'ATIVA',
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const aluno = await exigirAluno(tx, alunoId);
    if (aluno.status === 'EXCLUIDA') throw naoEncontrado('Aluno não encontrado.');
    if (aluno.status === novo) return aluno;

    if (novo === 'SUSPENSA') await suspenderNaTransacao(tx, alunoId);
    else await tx.usuario.update({ where: { id: alunoId }, data: { status: 'ATIVA' } });

    await registrar(tx, eu, novo === 'SUSPENSA' ? 'aluno_suspensao' : 'aluno_reativacao', {
      tipo: 'usuario',
      id: alunoId,
    });
    return { ...aluno, status: novo };
  });
}

/** RF33: registro de auditoria das ações da coordenação. */
export function listarAuditoria(ctx: Contexto, eu: Autenticado, pagina: number) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const [total, itens] = await Promise.all([
      tx.auditoria.count(),
      tx.auditoria.findMany({
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);
    const atores = new Map(
      (
        await tx.usuario.findMany({
          where: { id: { in: itens.flatMap((i) => (i.atorId ? [i.atorId] : [])) } },
          select: { id: true, nome: true },
        })
      ).map((u) => [u.id, u.nome]),
    );
    return {
      total,
      pagina,
      porPagina: POR_PAGINA,
      // BigInt não vira JSON: o id sai como texto.
      itens: itens.map((i) => ({
        ...i,
        id: i.id.toString(),
        atorNome: i.atorId ? (atores.get(i.atorId) ?? null) : null,
      })),
    };
  });
}
