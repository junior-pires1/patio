import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import type { Autenticado } from '../../seguranca/tokens';
import { exigirMatch } from '../conexoes/servico';
import type { NovaMensagem } from '../imagens/esquemas';
import { exigirImagemPropria, urlDaImagem } from '../imagens/servico';

const MENSAGEM = {
  id: true,
  autorId: true,
  texto: true,
  imagemId: true,
  criadoEm: true,
  lidaEm: true,
} as const;

const formatar = <M extends { imagemId: string | null }>({ imagemId, ...m }: M) => ({
  ...m,
  imagemUrl: urlDaImagem(imagemId),
});

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
  const { resposta, outroId, lidas } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const match = await exigirMatch(tx, eu, matchId);
      const pagina = await tx.mensagem.findMany({
        where: { matchId, ...(antes ? { criadoEm: { lt: antes } } : {}) },
        orderBy: { criadoEm: 'desc' },
        take: MENSAGENS_POR_PAGINA,
        select: MENSAGEM,
      });
      const { count } = await tx.mensagem.updateMany({
        where: { matchId, autorId: { not: eu.id }, lidaEm: null },
        data: { lidaEm: new Date() },
      });
      return {
        resposta: {
          mensagens: pagina.reverse().map(formatar),
          temMais: pagina.length === MENSAGENS_POR_PAGINA,
        },
        outroId: match.outroId,
        lidas: count,
      };
    },
  );
  // Quem mandou vê o "lida" aparecer sem recarregar.
  if (lidas > 0) ctx.notificar.enviar([outroId], 'mensagens:lidas', { matchId });
  return resposta;
}

/** RF: enviar mensagem. Os dois participantes recebem `mensagem:nova` em tempo real. */
export async function enviarMensagem(
  ctx: Contexto,
  eu: Autenticado,
  matchId: string,
  { texto, imagemId }: NovaMensagem,
) {
  const { mensagem, outroId } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const match = await exigirMatch(tx, eu, matchId);
      await exigirImagemPropria(tx, eu, imagemId);
      const criada = await tx.mensagem.create({
        data: { instituicaoId: eu.instituicaoId, matchId, autorId: eu.id, texto, imagemId },
        select: MENSAGEM,
      });
      return { mensagem: formatar(criada), outroId: match.outroId };
    },
  );
  ctx.notificar.enviar([eu.id, outroId], 'mensagem:nova', { matchId, mensagem });
  return mensagem;
}
