import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';

export const TAMANHO_MAXIMO = 1024 * 1024;

/** Descobre o tipo pela assinatura do arquivo, sem confiar no cabeçalho. */
export function tipoDaImagem(
  dados: Uint8Array,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const b = (i: number) => dados[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  const texto = (inicio: number, fim: number) =>
    String.fromCharCode(...dados.slice(inicio, fim));
  if (dados.length > 12 && texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

/**
 * RF06: grava (ou troca) a foto de perfil. A foto fica em /fotos/<id>; o
 * id é aleatório e muda a cada envio, então o endereço não é adivinhável e
 * o cache do aparelho sempre pega a versão nova.
 */
export async function enviarFoto(ctx: Contexto, eu: Autenticado, dados: Uint8Array) {
  if (dados.length === 0) throw new ErroApp(400, 'foto_vazia', 'Envie uma imagem.');
  if (dados.length > TAMANHO_MAXIMO) {
    throw new ErroApp(413, 'foto_grande', 'A foto pode ter no máximo 1 MB.');
  }
  const tipo = tipoDaImagem(dados);
  if (!tipo)
    throw new ErroApp(415, 'formato_invalido', 'Use uma foto em JPG, PNG ou WebP.');

  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await tx.foto.deleteMany({ where: { usuarioId: eu.id } });
    const foto = await tx.foto.create({
      data: {
        instituicaoId: eu.instituicaoId,
        usuarioId: eu.id,
        tipo,
        dados: Buffer.from(dados),
      },
      select: { id: true },
    });
    const fotoUrl = `/fotos/${foto.id}`;
    await tx.usuario.update({ where: { id: eu.id }, data: { fotoUrl } });
    return { fotoUrl };
  });
}

export function removerFoto(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await tx.foto.deleteMany({ where: { usuarioId: eu.id } });
    await tx.usuario.update({ where: { id: eu.id }, data: { fotoUrl: null } });
  });
}

/** Serve a imagem. Consulta direta pelo id (fora do RLS): o id aleatório é a chave de acesso. */
export async function lerFoto(ctx: Contexto, id: string) {
  const foto = await ctx.prisma.foto.findUnique({
    where: { id },
    select: { tipo: true, dados: true, usuario: { select: { status: true } } },
  });
  if (!foto || foto.usuario.status !== 'ATIVA') throw naoEncontrado('Foto não encontrada.');
  return foto;
}
