import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import type { PrismaClient } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import type { Evento, Notificador } from '../../servicos/notificador';

const ENDERECO_EXPO = 'https://exp.host/--/api/v2/push/send';

/** RF27: guarda o token do aparelho (o mesmo token passa para a conta que entrou por último). */
export function registrar(ctx: Contexto, eu: Autenticado, token: string) {
  return ctx.prisma.$transaction(async (tx) => {
    // Fora do RLS: o token pode ter sido de outra conta (até de outra faculdade) no mesmo aparelho.
    await tx.dispositivoPush.deleteMany({ where: { token } });
    await tx.dispositivoPush.create({
      data: { instituicaoId: eu.instituicaoId, usuarioId: eu.id, token },
    });
  });
}

export function remover(ctx: Contexto, eu: Autenticado, token: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.dispositivoPush.deleteMany({ where: { token, usuarioId: eu.id } }),
  );
}

type Mensagem = {
  titulo: string;
  texto: string;
  destino: string[];
  dados: Record<string, unknown>;
};

/** Traduz um evento do tempo real na notificação que aparece com o app fechado. */
export function mensagemDoEvento(
  usuarioIds: string[],
  evento: Evento,
  dados: unknown,
): Mensagem | null {
  const d = (dados ?? {}) as Record<string, unknown>;
  switch (evento) {
    case 'curtida:nova':
      return {
        titulo: 'Alguém curtiu você 💙',
        texto: 'Abra o Pátio para ver quem foi.',
        destino: usuarioIds,
        dados: { tipo: 'curtida' },
      };
    case 'match:novo':
      return {
        titulo: 'Nova conexão! 🎉',
        texto: 'Vocês se curtiram. Que tal dar um oi?',
        destino: usuarioIds,
        dados: { tipo: 'match', matchId: d.matchId },
      };
    case 'mensagem:nova': {
      const m = d.mensagem as { autorId?: string; texto?: string } | undefined;
      return {
        titulo: 'Nova mensagem',
        texto: m?.texto ?? '',
        destino: usuarioIds.filter((id) => id !== m?.autorId),
        dados: { tipo: 'mensagem', matchId: d.matchId },
      };
    }
    case 'grupo:mensagem': {
      const m = d.mensagem as
        { autor?: { id?: string; apelido?: string }; texto?: string } | undefined;
      return {
        titulo: `${m?.autor?.apelido ?? 'Alguém'} no grupo`,
        texto: m?.texto ?? '',
        destino: usuarioIds.filter((id) => id !== m?.autor?.id),
        dados: { tipo: 'grupo', grupoId: d.grupoId },
      };
    }
    default:
      return null;
  }
}

/**
 * Notificador que manda push pelo serviço gratuito da Expo para os aparelhos
 * cadastrados. Falhas não atrapalham a API: só ficam no log. Tokens que a
 * Expo diz que não existem mais são apagados.
 */
export function notificadorPush(
  prisma: PrismaClient,
  buscar: typeof fetch = fetch,
): Notificador {
  return {
    enviar(usuarioIds, evento, dados) {
      const mensagem = mensagemDoEvento(usuarioIds, evento, dados);
      if (!mensagem || mensagem.destino.length === 0) return;
      void (async () => {
        const aparelhos = await prisma.dispositivoPush.findMany({
          where: { usuarioId: { in: mensagem.destino } },
          select: { token: true },
        });
        if (aparelhos.length === 0) return;
        const resposta = await buscar(ENDERECO_EXPO, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(
            aparelhos.map((a) => ({
              to: a.token,
              title: mensagem.titulo,
              body: mensagem.texto.slice(0, 180),
              data: mensagem.dados,
              sound: 'default',
            })),
          ),
        });
        const corpo = (await resposta.json().catch(() => ({}))) as {
          data?: { status?: string; details?: { error?: string } }[];
        };
        const invalidos = (corpo.data ?? [])
          .map((ticket, i) =>
            ticket.details?.error === 'DeviceNotRegistered'
              ? aparelhos[i]?.token
              : undefined,
          )
          .filter((t): t is string => Boolean(t));
        if (invalidos.length > 0)
          await prisma.dispositivoPush.deleteMany({ where: { token: { in: invalidos } } });
      })().catch((erro: unknown) => console.error('[push] falha ao enviar', erro));
    },
  };
}
