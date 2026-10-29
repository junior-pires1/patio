import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { registrar } from '../coordenacao/auditoria';

const AVISO = {
  id: true,
  titulo: true,
  texto: true,
  fixado: true,
  criadoEm: true,
  autor: { select: { id: true, nome: true } },
} as const;

/** RF21: avisos oficiais da faculdade, fixados primeiro e os mais novos no topo. */
export function listarAvisos(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.aviso.findMany({
      where: { removidoEm: null },
      orderBy: [{ fixado: 'desc' }, { criadoEm: 'desc' }],
      take: 50,
      select: AVISO,
    }),
  );
}

/** RF32 / RN14: só a coordenação publica avisos, e só na própria faculdade. */
export function publicarAviso(
  ctx: Contexto,
  eu: Autenticado,
  dados: { titulo: string; texto: string; fixado: boolean },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const aviso = await tx.aviso.create({
      data: { ...dados, instituicaoId: eu.instituicaoId, autorId: eu.id },
      select: AVISO,
    });
    await registrar(
      tx,
      eu,
      'aviso_publicado',
      { tipo: 'aviso', id: aviso.id },
      { titulo: aviso.titulo },
    );
    return aviso;
  });
}

/** RF32: remover aviso (remoção lógica, fica no histórico). */
export function removerAviso(ctx: Contexto, eu: Autenticado, avisoId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const { count } = await tx.aviso.updateMany({
      where: { id: avisoId, removidoEm: null },
      data: { removidoEm: new Date() },
    });
    if (count === 0) throw naoEncontrado('Aviso não encontrado.');
    await registrar(tx, eu, 'aviso_removido', { tipo: 'aviso', id: avisoId });
  });
}
