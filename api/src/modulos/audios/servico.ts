import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';

export const TAMANHO_MAXIMO_AUDIO = 1024 * 1024;
export const DURACAO_MAXIMA_MS = 120_000;
const LIMITE_POR_HORA = 40;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export const urlDoAudio = (id: string | null) => (id ? `/audios/${id}` : null);

/** Formato do áudio pelos primeiros bytes (não confia no que o aparelho diz). */
export function tipoDoAudio(d: Uint8Array): string | null {
  const ascii = (inicio: number, fim: number) =>
    String.fromCharCode(...d.slice(inicio, fim));
  if (d[0] === 0x1a && d[1] === 0x45 && d[2] === 0xdf && d[3] === 0xa3) return 'audio/webm';
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (
    ascii(0, 3) === 'ID3' ||
    (d[0] === 0xff && (d[1]! & 0xe0) === 0xe0 && (d[1]! & 0x06) !== 0)
  )
    return 'audio/mpeg';
  if (d[0] === 0xff && (d[1]! & 0xf6) === 0xf0) return 'audio/aac';
  return null;
}

/** Recebe uma mensagem de voz (até 1 MB e 2 minutos). Fica guardada até ser enviada. */
export async function enviarAudio(
  ctx: Contexto,
  eu: Autenticado,
  dados: Uint8Array,
  duracaoMs: number,
) {
  if (dados.length === 0) throw new ErroApp(400, 'audio_vazio', 'Envie um áudio.');
  if (dados.length > TAMANHO_MAXIMO_AUDIO) {
    throw new ErroApp(413, 'audio_grande', 'O áudio pode ter no máximo 1 MB.');
  }
  const tipo = tipoDoAudio(dados);
  if (!tipo) throw new ErroApp(415, 'formato_invalido', 'Formato de áudio não aceito.');
  if (!Number.isInteger(duracaoMs) || duracaoMs < 1 || duracaoMs > DURACAO_MAXIMA_MS) {
    throw new ErroApp(400, 'duracao_invalida', 'A mensagem de voz pode ter até 2 minutos.');
  }
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const agora = Date.now();
    // Áudios gravados e não enviados há mais de um dia são apagados.
    await tx.audio.deleteMany({
      where: {
        autorId: eu.id,
        criadoEm: { lt: new Date(agora - UM_DIA_MS) },
        mensagens: { none: {} },
      },
    });
    const naUltimaHora = await tx.audio.count({
      where: { autorId: eu.id, criadoEm: { gte: new Date(agora - UM_DIA_MS / 24) } },
    });
    if (naUltimaHora >= LIMITE_POR_HORA) {
      throw new ErroApp(429, 'muitos_audios', 'Você gravou muitos áudios na última hora.');
    }
    const audio = await tx.audio.create({
      data: {
        instituicaoId: eu.instituicaoId,
        autorId: eu.id,
        tipo,
        dados: Buffer.from(dados),
        duracaoMs,
      },
      select: { id: true },
    });
    return { id: audio.id, url: urlDoAudio(audio.id), duracaoMs };
  });
}

/** O áudio precisa ser de quem envia e ainda não ter sido usado. */
export async function exigirAudioProprio(tx: Transacao, eu: Autenticado, audioId?: string) {
  if (!audioId) return;
  const audio = await tx.audio.findFirst({
    where: { id: audioId, autorId: eu.id },
    select: { _count: { select: { mensagens: true } } },
  });
  if (!audio) throw naoEncontrado('Áudio não encontrado.');
  if (audio._count.mensagens > 0) {
    throw new ErroApp(409, 'audio_em_uso', 'Esse áudio já foi enviado.');
  }
}

/** Leitura pelo id (como as imagens: o id aleatório é a chave). */
export async function lerAudio(ctx: Contexto, id: string) {
  const audio = await ctx.prisma.audio.findUnique({
    where: { id },
    select: {
      tipo: true,
      dados: true,
      autor: { select: { status: true } },
      instituicao: { select: { ativa: true } },
    },
  });
  if (!audio || audio.autor.status !== 'ATIVA' || !audio.instituicao.ativa) {
    throw naoEncontrado('Áudio não encontrado.');
  }
  return audio;
}
