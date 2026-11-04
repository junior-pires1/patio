import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { exigirAudioProprio, urlDoAudio } from '../audios/servico';
import { exigirMatch } from '../conexoes/servico';
import { postCompartilhado, type PostCompartilhado } from '../feed/servico';
import type { NovaMensagemConversa } from '../imagens/esquemas';
import { exigirImagemPropria, urlDaImagem } from '../imagens/servico';

export const REACOES = ['AMEI', 'JOINHA', 'RISADA', 'UAU', 'TRISTE', 'FOGO'] as const;
export type Reacao = (typeof REACOES)[number];

const MENSAGEM = {
  id: true,
  autorId: true,
  texto: true,
  imagemId: true,
  criadoEm: true,
  lidaEm: true,
  postId: true,
  apagadaEm: true,
  audio: { select: { id: true, duracaoMs: true } },
  resposta: {
    select: {
      id: true,
      autorId: true,
      texto: true,
      imagemId: true,
      audioId: true,
      postId: true,
      apagadaEm: true,
    },
  },
  reacoes: { select: { usuarioId: true, reacao: true }, orderBy: { criadoEm: 'asc' } },
} as const;

type MensagemDoBanco = {
  id: string;
  autorId: string;
  texto: string;
  imagemId: string | null;
  criadoEm: Date;
  lidaEm: Date | null;
  postId: string | null;
  apagadaEm: Date | null;
  audio: { id: string; duracaoMs: number } | null;
  resposta: {
    id: string;
    autorId: string;
    texto: string;
    imagemId: string | null;
    audioId: string | null;
    postId: string | null;
    apagadaEm: Date | null;
  } | null;
  reacoes: { usuarioId: string; reacao: string }[];
};

/** Mensagem como o app recebe. Apagada perde o conteúdo e vira "Mensagem apagada". */
function formatar(m: MensagemDoBanco, posts: Map<string, PostCompartilhado>) {
  const apagada = m.apagadaEm !== null;
  const r = m.resposta;
  return {
    id: m.id,
    autorId: m.autorId,
    criadoEm: m.criadoEm,
    lidaEm: m.lidaEm,
    apagada,
    texto: apagada ? '' : m.texto,
    imagemUrl: apagada ? null : urlDaImagem(m.imagemId),
    audio:
      apagada || !m.audio
        ? null
        : { url: urlDoAudio(m.audio.id)!, duracaoMs: m.audio.duracaoMs },
    // Publicação apagada ou de alguém bloqueado aparece como indisponível.
    post:
      apagada || !m.postId
        ? null
        : (posts.get(m.postId) ?? { id: m.postId, indisponivel: true as const }),
    resposta: r
      ? {
          id: r.id,
          autorId: r.autorId,
          apagada: r.apagadaEm !== null,
          // Resumo do que foi respondido, como no WhatsApp.
          resumo:
            r.apagadaEm !== null
              ? 'Mensagem apagada'
              : r.texto.slice(0, 120) ||
                (r.audioId
                  ? 'Mensagem de voz'
                  : r.imagemId
                    ? 'Foto'
                    : r.postId
                      ? 'Publicação'
                      : ''),
        }
      : null,
    reacoes: apagada ? [] : m.reacoes,
  };
}

async function formatarVarias(tx: Transacao, eu: Autenticado, lista: MensagemDoBanco[]) {
  const posts = await postCompartilhado(
    tx,
    eu,
    lista.flatMap((m) => (m.postId && !m.apagadaEm ? [m.postId] : [])),
  );
  return lista.map((m) => formatar(m, posts));
}

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
          mensagens: await formatarVarias(tx, eu, pagina.reverse()),
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

/** RF: enviar mensagem (texto, foto, voz, publicação, e opcionalmente respondendo outra). */
export async function enviarMensagem(
  ctx: Contexto,
  eu: Autenticado,
  matchId: string,
  { texto, imagemId, postId, audioId, respostaId }: NovaMensagemConversa,
) {
  const { mensagem, outroId } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const match = await exigirMatch(tx, eu, matchId);
      await exigirImagemPropria(tx, eu, imagemId);
      await exigirAudioProprio(tx, eu, audioId);
      if (respostaId) {
        const alvo = await tx.mensagem.findFirst({
          where: { id: respostaId, matchId },
          select: { id: true },
        });
        if (!alvo) throw naoEncontrado('Mensagem respondida não encontrada.');
      }
      const posts = await postCompartilhado(tx, eu, postId ? [postId] : []);
      if (postId && !posts.has(postId)) throw naoEncontrado('Publicação não encontrada.');
      const criada = await tx.mensagem.create({
        data: {
          instituicaoId: eu.instituicaoId,
          matchId,
          autorId: eu.id,
          texto,
          imagemId,
          postId,
          audioId,
          respostaId,
        },
        select: MENSAGEM,
      });
      return { mensagem: formatar(criada, posts), outroId: match.outroId };
    },
  );
  ctx.notificar.enviar([eu.id, outroId], 'mensagem:nova', { matchId, mensagem });
  return mensagem;
}

/** Mensagem de uma conversa da pessoa (para reagir ou apagar). */
async function exigirMensagem(tx: Transacao, eu: Autenticado, mensagemId: string) {
  const m = await tx.mensagem.findUnique({
    where: { id: mensagemId },
    select: {
      id: true,
      matchId: true,
      autorId: true,
      apagadaEm: true,
      imagemId: true,
      audioId: true,
    },
  });
  if (!m) throw naoEncontrado('Mensagem não encontrada.');
  const match = await exigirMatch(tx, eu, m.matchId);
  return { ...m, outroId: match.outroId };
}

async function atualizada(eu: Autenticado, tx: Transacao, mensagemId: string) {
  const m = await tx.mensagem.findUniqueOrThrow({
    where: { id: mensagemId },
    select: MENSAGEM,
  });
  const [mensagem] = await formatarVarias(tx, eu, [m]);
  return mensagem!;
}

/** Reagir (ou trocar a reação) numa mensagem. `null` tira a reação. */
export async function reagir(
  ctx: Contexto,
  eu: Autenticado,
  mensagemId: string,
  reacao: Reacao | null,
) {
  const { mensagem, matchId, outroId } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const m = await exigirMensagem(tx, eu, mensagemId);
      if (m.apagadaEm)
        throw new ErroApp(409, 'mensagem_apagada', 'Essa mensagem foi apagada.');
      if (reacao) {
        await tx.reacaoMensagem.upsert({
          where: { mensagemId_usuarioId: { mensagemId, usuarioId: eu.id } },
          create: { instituicaoId: eu.instituicaoId, mensagemId, usuarioId: eu.id, reacao },
          update: { reacao, criadoEm: new Date() },
        });
      } else {
        await tx.reacaoMensagem.deleteMany({ where: { mensagemId, usuarioId: eu.id } });
      }
      return {
        mensagem: await atualizada(eu, tx, mensagemId),
        matchId: m.matchId,
        outroId: m.outroId,
      };
    },
  );
  ctx.notificar.enviar([eu.id, outroId], 'mensagem:atualizada', { matchId, mensagem });
  return mensagem;
}

/** Apagar a própria mensagem para os dois (fica "Mensagem apagada"). */
export async function apagarMensagem(ctx: Contexto, eu: Autenticado, mensagemId: string) {
  const { mensagem, matchId, outroId } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const m = await exigirMensagem(tx, eu, mensagemId);
      if (m.autorId !== eu.id) {
        throw new ErroApp(403, 'sem_permissao', 'Só quem enviou pode apagar a mensagem.');
      }
      if (!m.apagadaEm) {
        await tx.mensagem.update({
          where: { id: mensagemId },
          data: {
            apagadaEm: new Date(),
            texto: '',
            postId: null,
            imagemId: null,
            audioId: null,
          },
        });
        // Foto e áudio da mensagem apagada deixam de existir.
        if (m.imagemId) await tx.imagem.delete({ where: { id: m.imagemId } });
        if (m.audioId) await tx.audio.delete({ where: { id: m.audioId } });
        await tx.reacaoMensagem.deleteMany({ where: { mensagemId } });
      }
      return {
        mensagem: await atualizada(eu, tx, mensagemId),
        matchId: m.matchId,
        outroId: m.outroId,
      };
    },
  );
  ctx.notificar.enviar([eu.id, outroId], 'mensagem:atualizada', { matchId, mensagem });
  return mensagem;
}

/** "Digitando…": avisa a outra pessoa da conversa (o app chama a cada poucos segundos). */
export async function digitando(ctx: Contexto, eu: Autenticado, matchId: string) {
  const outroId = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const match = await exigirMatch(tx, eu, matchId);
    return match.outroId;
  });
  ctx.notificar.enviar([outroId], 'mensagem:digitando', { matchId, usuarioId: eu.id });
}
