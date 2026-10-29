import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { emOrdem } from '../conexoes/servico';

type Motivo =
  | 'PERFIL_FALSO'
  | 'ASSEDIO'
  | 'CONTEUDO_IMPROPRIO'
  | 'SPAM'
  | 'VENDA_DE_TRABALHOS'
  | 'OUTRO';

const contraSiMesmo = () =>
  new ErroApp(
    422,
    'contra_si_mesmo',
    'Esta ação não pode ser feita com a sua própria conta.',
  );

async function exigirUsuario(tx: Transacao, id: string) {
  const alvo = await tx.usuario.findUnique({ where: { id }, select: { id: true } });
  if (!alvo) throw naoEncontrado('Perfil não encontrado.');
}

async function bloquearNaTransacao(tx: Transacao, eu: Autenticado, usuarioId: string) {
  await tx.bloqueio.createMany({
    data: [
      { instituicaoId: eu.instituicaoId, bloqueadorId: eu.id, bloqueadoId: usuarioId },
    ],
    skipDuplicates: true,
  });
  // Bloquear encerra a conexão, se houver (RN).
  const [usuarioAId, usuarioBId] = emOrdem(eu.id, usuarioId);
  await tx.match.updateMany({
    where: { usuarioAId, usuarioBId, desfeitoEm: null },
    data: { desfeitoEm: new Date() },
  });
}

/** RF: bloquear. A outra pessoa deixa de ver o perfil e não é avisada. */
export function bloquear(ctx: Contexto, eu: Autenticado, usuarioId: string) {
  if (usuarioId === eu.id) throw contraSiMesmo();
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirUsuario(tx, usuarioId);
    await bloquearNaTransacao(tx, eu, usuarioId);
  });
}

export function desbloquear(ctx: Contexto, eu: Autenticado, usuarioId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.bloqueio.deleteMany({ where: { bloqueadorId: eu.id, bloqueadoId: usuarioId } }),
  );
}

export function listarBloqueios(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.bloqueio.findMany({
      where: { bloqueadorId: eu.id },
      orderBy: { criadoEm: 'desc' },
      select: {
        criadoEm: true,
        bloqueado: { select: { id: true, apelido: true, fotoUrl: true } },
      },
    }),
  );
}

/**
 * RF: denunciar para a coordenação. Só uma denúncia aberta por pessoa
 * denunciada; quem denuncia pode bloquear na mesma ação.
 */
export function denunciar(
  ctx: Contexto,
  eu: Autenticado,
  dados: { denunciadoId: string; motivo: Motivo; detalhe?: string; bloquear: boolean },
) {
  if (dados.denunciadoId === eu.id) throw contraSiMesmo();
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirUsuario(tx, dados.denunciadoId);
    const aberta = await tx.denuncia.findFirst({
      where: { denuncianteId: eu.id, denunciadoId: dados.denunciadoId, status: 'ABERTA' },
      select: { id: true },
    });
    if (aberta) {
      throw new ErroApp(
        409,
        'denuncia_ja_aberta',
        'Você já denunciou esta pessoa. A coordenação vai analisar.',
      );
    }
    const denuncia = await tx.denuncia.create({
      data: {
        instituicaoId: eu.instituicaoId,
        denuncianteId: eu.id,
        denunciadoId: dados.denunciadoId,
        motivo: dados.motivo,
        detalhe: dados.detalhe,
      },
      select: { id: true, status: true, motivo: true, criadoEm: true },
    });
    if (dados.bloquear) await bloquearNaTransacao(tx, eu, dados.denunciadoId);
    return denuncia;
  });
}
