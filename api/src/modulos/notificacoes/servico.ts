import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import type { Autenticado } from '../../seguranca/tokens';
import { urlDaImagem } from '../imagens/servico';

export type TipoNotificacao =
  | 'POST_CURTIDO'
  | 'POST_COMENTADO'
  | 'COMENTARIO_RESPONDIDO'
  | 'COMENTARIO_CURTIDO'
  | 'MENCAO'
  | 'CONEXAO_NOVA'
  | 'RECOMENDACAO'
  | 'SUPER_CURTIDA'
  | 'NOVO_SEGUIDOR'
  | 'CANDIDATURA_NOVA'
  | 'CANDIDATURA_ATUALIZADA';

/** Frase da notificação (no app e no push). */
const FRASES: Record<TipoNotificacao, string> = {
  POST_CURTIDO: 'curtiu sua publicação',
  POST_COMENTADO: 'comentou na sua publicação',
  COMENTARIO_RESPONDIDO: 'respondeu seu comentário',
  COMENTARIO_CURTIDO: 'curtiu seu comentário',
  MENCAO: 'mencionou você',
  CONEXAO_NOVA: 'agora é sua conexão',
  RECOMENDACAO: 'recomendou uma habilidade sua',
  SUPER_CURTIDA: 'deu uma super curtida em você',
  NOVO_SEGUIDOR: 'começou a seguir você',
  CANDIDATURA_NOVA: 'se candidatou à sua vaga',
  CANDIDATURA_ATUALIZADA: 'atualizou sua candidatura',
};

// Curtidas repetidas (curtir, descurtir, curtir) não viram várias notificações.
const SUBSTITUI: TipoNotificacao[] = ['POST_CURTIDO', 'COMENTARIO_CURTIDO'];

export type NovaNotificacao = {
  para: string;
  tipo: TipoNotificacao;
  postId?: string;
  comentarioId?: string;
  matchId?: string;
  vagaId?: string;
  texto?: string | null;
};

/** O que avisar em tempo real depois que a transação terminar. */
export type Aviso = { para: string; titulo: string; texto: string; tipo: TipoNotificacao };

/**
 * Cria notificações dentro da transação. Não avisa a própria pessoa, nem
 * quem não é aluno, nem quem tem bloqueio com quem fez a ação (RN11).
 * Devolve a lista para `avisar()` depois do commit.
 */
export async function notificar(
  tx: Transacao,
  eu: Autenticado,
  lista: NovaNotificacao[],
): Promise<Aviso[]> {
  const alvos = [...new Set(lista.map((n) => n.para))].filter((id) => id !== eu.id);
  if (alvos.length === 0) return [];
  const validos = await tx.usuario.findMany({
    where: {
      id: { in: alvos },
      papel: 'ALUNO',
      status: 'ATIVA',
      bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
      bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
    },
    select: { id: true },
  });
  const ok = new Set(validos.map((v) => v.id));
  const ator = await tx.usuario.findUnique({
    where: { id: eu.id },
    select: { apelido: true },
  });
  const avisos: Aviso[] = [];
  const vistos = new Set<string>();
  for (const n of lista) {
    const chave = `${n.para}|${n.tipo}`;
    if (!ok.has(n.para) || vistos.has(chave)) continue;
    vistos.add(chave);
    if (SUBSTITUI.includes(n.tipo)) {
      await tx.notificacao.deleteMany({
        where: {
          usuarioId: n.para,
          atorId: eu.id,
          tipo: n.tipo,
          postId: n.postId ?? null,
          comentarioId: n.comentarioId ?? null,
        },
      });
    }
    await tx.notificacao.create({
      data: {
        instituicaoId: eu.instituicaoId,
        usuarioId: n.para,
        atorId: eu.id,
        tipo: n.tipo,
        postId: n.postId,
        comentarioId: n.comentarioId,
        matchId: n.matchId,
        vagaId: n.vagaId,
        texto: n.texto ? n.texto.slice(0, 160) : null,
      },
    });
    avisos.push({
      para: n.para,
      tipo: n.tipo,
      titulo: `${ator?.apelido ?? 'Alguém'} ${FRASES[n.tipo]}`,
      texto: n.texto?.slice(0, 120) ?? '',
    });
  }
  return avisos;
}

/** Envia, depois do commit, o aviso em tempo real (e o push) de cada notificação. */
export function avisar(ctx: Contexto, avisos: Aviso[]) {
  for (const a of avisos) {
    ctx.notificar.enviar([a.para], 'notificacao:nova', {
      tipo: a.tipo,
      titulo: a.titulo,
      texto: a.texto,
    });
  }
}

export const NOTIFICACOES_POR_PAGINA = 30;

/** Central de notificações, da mais nova para a mais antiga. */
export function listar(ctx: Contexto, eu: Autenticado, antes?: Date) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const itens = await tx.notificacao.findMany({
      where: {
        usuarioId: eu.id,
        ...(antes ? { criadoEm: { lt: antes } } : {}),
        // Quem bloqueou ou foi bloqueado some da lista também.
        OR: [
          { atorId: null },
          {
            ator: {
              status: 'ATIVA',
              bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
              bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
            },
          },
        ],
      },
      orderBy: { criadoEm: 'desc' },
      take: NOTIFICACOES_POR_PAGINA,
      select: {
        id: true,
        tipo: true,
        texto: true,
        criadoEm: true,
        lidaEm: true,
        matchId: true,
        vagaId: true,
        comentarioId: true,
        ator: { select: { id: true, apelido: true, fotoUrl: true } },
        post: { select: { id: true, imagemId: true, removidoEm: true } },
      },
    });
    return {
      notificacoes: itens.map(({ post, tipo, lidaEm, ...n }) => ({
        ...n,
        tipo: tipo as TipoNotificacao,
        frase: FRASES[tipo as TipoNotificacao] ?? '',
        lida: lidaEm !== null,
        post:
          post && !post.removidoEm
            ? { id: post.id, imagemUrl: urlDaImagem(post.imagemId) }
            : null,
      })),
      temMais: itens.length === NOTIFICACOES_POR_PAGINA,
    };
  });
}

export function naoLidas(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => ({
    total: await tx.notificacao.count({ where: { usuarioId: eu.id, lidaEm: null } }),
  }));
}

/** Marca todas como lidas (abrir a central). */
export async function marcarLidas(ctx: Contexto, eu: Autenticado) {
  await naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.notificacao.updateMany({
      where: { usuarioId: eu.id, lidaEm: null },
      data: { lidaEm: new Date() },
    }),
  );
  ctx.notificar.enviar([eu.id], 'notificacoes:lidas', {});
}
