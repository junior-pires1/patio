import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { TAMANHO_MAXIMO, tipoDaImagem } from '../fotos/servico';

/** Envios por pessoa em uma hora: o bastante para conversar, pouco para lotar o banco. */
export const LIMITE_POR_HORA = 30;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export const urlDaImagem = (id: string | null) => (id ? `/imagens/${id}` : null);

/**
 * Recebe a imagem de uma publicação ou mensagem. Ela fica guardada até ser
 * usada; imagens da pessoa que ficaram mais de um dia sem uso são apagadas.
 */
export async function enviarImagem(ctx: Contexto, eu: Autenticado, dados: Uint8Array) {
  if (dados.length === 0) throw new ErroApp(400, 'imagem_vazia', 'Envie uma imagem.');
  if (dados.length > TAMANHO_MAXIMO) {
    throw new ErroApp(413, 'imagem_grande', 'A imagem pode ter no máximo 1 MB.');
  }
  const tipo = tipoDaImagem(dados);
  if (!tipo) {
    throw new ErroApp(415, 'formato_invalido', 'Use uma imagem em JPG, PNG ou WebP.');
  }

  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const agora = Date.now();
    await tx.imagem.deleteMany({
      where: {
        autorId: eu.id,
        criadoEm: { lt: new Date(agora - UM_DIA_MS) },
        posts: { none: {} },
        mensagens: { none: {} },
        grupoMensagens: { none: {} },
        stories: { none: {} },
      },
    });
    const naUltimaHora = await tx.imagem.count({
      where: { autorId: eu.id, criadoEm: { gte: new Date(agora - UM_DIA_MS / 24) } },
    });
    if (naUltimaHora >= LIMITE_POR_HORA) {
      throw new ErroApp(
        429,
        'muitas_imagens',
        'Você enviou muitas imagens na última hora. Tente mais tarde.',
      );
    }
    const imagem = await tx.imagem.create({
      data: {
        instituicaoId: eu.instituicaoId,
        autorId: eu.id,
        tipo,
        dados: Buffer.from(dados),
      },
      select: { id: true },
    });
    return { id: imagem.id, url: urlDaImagem(imagem.id) };
  });
}

/**
 * Confere se a imagem pode ir na publicação ou mensagem: precisa ser de quem
 * está enviando (o RLS já garante a mesma faculdade). Usar duas vezes a mesma
 * imagem é barrado pelo banco (UNIQUE).
 */
export async function exigirImagemPropria(
  tx: Transacao,
  eu: Autenticado,
  imagemId: string | undefined,
) {
  if (!imagemId) return;
  const imagem = await tx.imagem.findFirst({
    where: { id: imagemId, autorId: eu.id },
    select: { id: true },
  });
  if (!imagem) {
    throw new ErroApp(422, 'imagem_invalida', 'Imagem não encontrada. Envie de novo.', {
      imagemId: 'Imagem não encontrada',
    });
  }
}

/** Serve a imagem. Consulta direta pelo id (fora do RLS): o id aleatório é a chave de acesso. */
export async function lerImagem(ctx: Contexto, id: string) {
  const imagem = await ctx.prisma.imagem.findUnique({
    where: { id },
    select: {
      tipo: true,
      dados: true,
      autor: { select: { status: true } },
      instituicao: { select: { ativa: true } },
    },
  });
  if (!imagem || imagem.autor.status !== 'ATIVA' || !imagem.instituicao.ativa) {
    throw naoEncontrado('Imagem não encontrada.');
  }
  return imagem;
}
