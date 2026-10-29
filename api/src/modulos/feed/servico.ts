import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { registrar } from '../coordenacao/auditoria';

export const POSTS_POR_PAGINA = 20;
export type Categoria = 'GERAL' | 'EVENTO' | 'ESTUDOS' | 'VAGA' | 'ACHADOS';

const AUTOR = { select: { id: true, apelido: true, fotoUrl: true, papel: true } } as const;

/**
 * Autores visíveis para a pessoa: contas ativas e sem bloqueio em nenhum
 * sentido (RN11). A coordenação vê tudo da faculdade, para moderar.
 */
function autorVisivel(eu: Autenticado): Prisma.UsuarioWhereInput {
  if (eu.papel === 'COORDENACAO') return {};
  return {
    status: 'ATIVA',
    bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
    bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
  };
}

function selecaoDoPost(eu: Autenticado) {
  return {
    id: true,
    categoria: true,
    texto: true,
    imagemUrl: true,
    eventoInicio: true,
    eventoLocal: true,
    criadoEm: true,
    autor: AUTOR,
    curtidas: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    presencas: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    _count: { select: { curtidas: true, comentarios: true, presencas: true } },
  } satisfies Prisma.PostSelect;
}

type PostDoBanco = Prisma.PostGetPayload<{ select: ReturnType<typeof selecaoDoPost> }>;

function formatar({ curtidas, presencas, _count, ...p }: PostDoBanco, eu: Autenticado) {
  return {
    ...p,
    curtidas: _count.curtidas,
    comentarios: _count.comentarios,
    presencas: _count.presencas,
    curti: curtidas.length > 0,
    vou: presencas.length > 0,
    meu: p.autor.id === eu.id,
  };
}

/** RF18/RF21: feed da faculdade, do mais novo para o mais antigo. */
export function listarFeed(
  ctx: Contexto,
  eu: Autenticado,
  filtro: { categoria?: Categoria; antes?: Date },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const posts = await tx.post.findMany({
      where: {
        removidoEm: null,
        autor: autorVisivel(eu),
        ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
        ...(filtro.antes ? { criadoEm: { lt: filtro.antes } } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take: POSTS_POR_PAGINA,
      select: selecaoDoPost(eu),
    });
    return {
      posts: posts.map((p) => formatar(p, eu)),
      temMais: posts.length === POSTS_POR_PAGINA,
    };
  });
}

async function exigirPost(tx: Transacao, eu: Autenticado, postId: string) {
  const post = await tx.post.findFirst({
    where: { id: postId, removidoEm: null, autor: autorVisivel(eu) },
    select: selecaoDoPost(eu),
  });
  if (!post) throw naoEncontrado('Publicação não encontrada.');
  return post;
}

export function verPost(ctx: Contexto, eu: Autenticado, postId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) =>
    formatar(await exigirPost(tx, eu, postId), eu),
  );
}

/** RF18: publicar no feed. Evento exige data de início (RN18). */
export function publicar(
  ctx: Contexto,
  eu: Autenticado,
  dados: {
    categoria: Categoria;
    texto: string;
    imagemUrl?: string;
    eventoInicio?: Date;
    eventoLocal?: string;
  },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const post = await tx.post.create({
      data: { ...dados, instituicaoId: eu.instituicaoId, autorId: eu.id },
      select: selecaoDoPost(eu),
    });
    return formatar(post, eu);
  });
}

/** Remove a publicação: o autor remove a sua; a coordenação, qualquer uma (com auditoria). */
export function removerPost(ctx: Contexto, eu: Autenticado, postId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const post = await exigirPost(tx, eu, postId);
    const ehAutor = post.autor.id === eu.id;
    if (!ehAutor && eu.papel !== 'COORDENACAO') {
      throw new ErroApp(403, 'sem_permissao', 'Só quem publicou pode remover.');
    }
    await tx.post.update({ where: { id: postId }, data: { removidoEm: new Date() } });
    if (!ehAutor) {
      await registrar(
        tx,
        eu,
        'post_removido',
        { tipo: 'post', id: postId },
        { autorId: post.autor.id },
      );
    }
  });
}

/** RF19: curtir ou descurtir a publicação. Devolve o total atualizado. */
export function curtirPost(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  curtir: boolean,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirPost(tx, eu, postId);
    if (curtir) {
      await tx.curtidaPost.createMany({
        data: [{ instituicaoId: eu.instituicaoId, postId, usuarioId: eu.id }],
        skipDuplicates: true,
      });
    } else {
      await tx.curtidaPost.deleteMany({ where: { postId, usuarioId: eu.id } });
    }
    return { curti: curtir, curtidas: await tx.curtidaPost.count({ where: { postId } }) };
  });
}

/** RF20: confirmar ou desmarcar presença. Só em publicações de evento. */
export function marcarPresenca(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  vou: boolean,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const post = await exigirPost(tx, eu, postId);
    if (post.categoria !== 'EVENTO') {
      throw new ErroApp(422, 'nao_e_evento', 'Só dá para confirmar presença em eventos.');
    }
    if (vou) {
      await tx.presencaEvento.createMany({
        data: [{ instituicaoId: eu.instituicaoId, postId, usuarioId: eu.id }],
        skipDuplicates: true,
      });
    } else {
      await tx.presencaEvento.deleteMany({ where: { postId, usuarioId: eu.id } });
    }
    return { vou, presencas: await tx.presencaEvento.count({ where: { postId } }) };
  });
}

/** RF19: comentários, do mais antigo para o mais novo. */
export function listarComentarios(ctx: Contexto, eu: Autenticado, postId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirPost(tx, eu, postId);
    const comentarios = await tx.comentario.findMany({
      where: { postId, autor: autorVisivel(eu) },
      orderBy: { criadoEm: 'asc' },
      take: 200,
      select: { id: true, texto: true, criadoEm: true, autor: AUTOR },
    });
    return comentarios.map((c) => ({ ...c, meu: c.autor.id === eu.id }));
  });
}

export function comentar(ctx: Contexto, eu: Autenticado, postId: string, texto: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirPost(tx, eu, postId);
    const c = await tx.comentario.create({
      data: { instituicaoId: eu.instituicaoId, postId, autorId: eu.id, texto },
      select: { id: true, texto: true, criadoEm: true, autor: AUTOR },
    });
    return { ...c, meu: true };
  });
}

/** O autor apaga o próprio comentário; a coordenação, qualquer um. */
export function apagarComentario(ctx: Contexto, eu: Autenticado, comentarioId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const c = await tx.comentario.findUnique({
      where: { id: comentarioId },
      select: { autorId: true },
    });
    if (!c) throw naoEncontrado('Comentário não encontrado.');
    if (c.autorId !== eu.id && eu.papel !== 'COORDENACAO') {
      throw new ErroApp(403, 'sem_permissao', 'Só quem comentou pode apagar.');
    }
    await tx.comentario.delete({ where: { id: comentarioId } });
  });
}
