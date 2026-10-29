import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import type { Autenticado } from '../../seguranca/tokens';
import { exigirMatch } from '../conexoes/servico';

export const MENSAGENS_POR_PAGINA = 50;

/**
 * RF: mensagens da conversa, das mais antigas para as mais novas. `antes`
 * busca a página anterior. Abrir a conversa marca como lidas as mensagens
 * da outra pessoa.
 */
export async function listarMensagens(
  ctx: Contexto,
  eu: Autenticado,
  matchId: string,
  antes?: Date,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirMatch(tx, eu, matchId);
    const pagina = await tx.mensagem.findMany({
      where: { matchId, ...(antes ? { criadoEm: { lt: antes } } : {}) },
      orderBy: { criadoEm: 'desc' },
      take: MENSAGENS_POR_PAGINA,
      select: { id: true, autorId: true, texto: true, criadoEm: true, lidaEm: true },
    });
    await tx.mensagem.updateMany({
      where: { matchId, autorId: { not: eu.id }, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return { mensagens: pagina.reverse(), temMais: pagina.length === MENSAGENS_POR_PAGINA };
  });
}

/** RF: enviar mensagem. Os dois participantes recebem `mensagem:nova` em tempo real. */
export async function enviarMensagem(
  ctx: Contexto,
  eu: Autenticado,
  matchId: string,
  texto: string,
) {
  const { mensagem, outroId } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const match = await exigirMatch(tx, eu, matchId);
      const criada = await tx.mensagem.create({
        data: { instituicaoId: eu.instituicaoId, matchId, autorId: eu.id, texto },
        select: { id: true, autorId: true, texto: true, criadoEm: true, lidaEm: true },
      });
      return { mensagem: criada, outroId: match.outroId };
    },
  );
  ctx.notificar.enviar([eu.id, outroId], 'mensagem:nova', { matchId, mensagem });
  return mensagem;
}
