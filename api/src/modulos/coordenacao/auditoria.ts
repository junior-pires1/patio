import type { Transacao } from '../../banco/prisma';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';

/** RN15: toda decisão da coordenação fica registrada em auditoria. */
export function registrar(
  tx: Transacao,
  eu: Autenticado,
  acao: string,
  alvo: { tipo: string; id: string },
  detalhes: Prisma.InputJsonObject = {},
) {
  return tx.auditoria.create({
    data: {
      instituicaoId: eu.instituicaoId,
      atorTipo: 'COORDENACAO',
      atorId: eu.id,
      acao,
      alvoTipo: alvo.tipo,
      alvoId: alvo.id,
      detalhes,
    },
  });
}
