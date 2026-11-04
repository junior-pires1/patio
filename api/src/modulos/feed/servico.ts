import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { registrar } from '../coordenacao/auditoria';
import { exigirImagemPropria, urlDaImagem } from '../imagens/servico';
import { avisar, notificar, type NovaNotificacao } from '../notificacoes/servico';

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
    imagemId: true,
    eventoInicio: true,
    eventoLocal: true,
    criadoEm: true,
    autor: AUTOR,
    curtidas: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    presencas: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    salvos: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    mencoes: true,
    _count: { select: { curtidas: true, comentarios: true, presencas: true } },
  } satisfies Prisma.PostSelect;
}

type PostDoBanco = Prisma.PostGetPayload<{ select: ReturnType<typeof selecaoDoPost> }>;

export type Mencionado = { id: string; apelido: string };

/** Troca os ids marcados com @ por { id, apelido } (só de quem a pessoa pode ver). */
export async function resolverMencoes(tx: Transacao, eu: Autenticado, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map<string, Mencionado>();
  const pessoas = await tx.usuario.findMany({
    where: { id: { in: unicos }, papel: 'ALUNO', ...autorVisivel(eu) },
    select: { id: true, apelido: true },
  });
  return new Map(pessoas.map((x) => [x.id, x]));
}

/** Confere as menções enviadas pelo app: só alunos visíveis da faculdade, sem repetir. */
export async function validarMencoes(tx: Transacao, eu: Autenticado, ids: string[] = []) {
  return [...(await resolverMencoes(tx, eu, ids)).keys()];
}

async function formatarVarios(tx: Transacao, eu: Autenticado, posts: PostDoBanco[]) {
  const mapa = await resolverMencoes(
    tx,
    eu,
    posts.flatMap((p) => p.mencoes),
  );
  return posts.map((p) => formatar(p, eu, mapa));
}

function formatar(
  { curtidas, presencas, salvos, mencoes, _count, imagemId, ...p }: PostDoBanco,
  eu: Autenticado,
  mapa: Map<string, Mencionado>,
) {
  return {
    ...p,
    mencoes: mencoes.flatMap((id) => (mapa.has(id) ? [mapa.get(id)!] : [])),
    salvo: salvos.length > 0,
    imagemUrl: urlDaImagem(imagemId),
    curtidas: _count.curtidas,
    comentarios: _count.comentarios,
    presencas: _count.presencas,
    curti: curtidas.length > 0,
    vou: presencas.length > 0,
    meu: p.autor.id === eu.id,
  };
}

export type FiltroPosts = {
  categoria?: Categoria;
  antes?: Date;
  /** Só as publicações desta pessoa (grade do perfil). */
  autorId?: string;
  /** Texto contido na publicação (busca). */
  texto?: string;
  /** Só as que esta pessoa curtiu (atividade). */
  curtidoPor?: string;
  /** Só as que esta pessoa salvou. */
  salvoPor?: string;
  /** Só as que têm esta hashtag (sem o #). */
  hashtag?: string;
};

/** RF18/RF21: feed da faculdade, do mais novo para o mais antigo. */
export function listarFeed(
  ctx: Contexto,
  eu: Autenticado,
  filtro: { categoria?: Categoria; antes?: Date },
) {
  return listarPosts(ctx, eu, filtro);
}

/** Publicações visíveis para a pessoa, com filtros (feed, perfil, busca, curtidas). */
export function listarPosts(ctx: Contexto, eu: Autenticado, filtro: FiltroPosts) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const posts = await tx.post.findMany({
      where: {
        removidoEm: null,
        autor: autorVisivel(eu),
        ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
        ...(filtro.antes ? { criadoEm: { lt: filtro.antes } } : {}),
        ...(filtro.autorId ? { autorId: filtro.autorId } : {}),
        ...(filtro.texto ? { texto: { contains: filtro.texto, mode: 'insensitive' } } : {}),
        ...(filtro.curtidoPor
          ? { curtidas: { some: { usuarioId: filtro.curtidoPor } } }
          : {}),
        ...(filtro.salvoPor ? { salvos: { some: { usuarioId: filtro.salvoPor } } } : {}),
        ...(filtro.hashtag
          ? { texto: { contains: `#${filtro.hashtag}`, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take: POSTS_POR_PAGINA,
      select: selecaoDoPost(eu),
    });
    // "#calculo" não pode trazer "#calculo2": confere a palavra inteira.
    const filtrados = filtro.hashtag
      ? posts.filter((p) => hashtagsDe(p.texto).includes(filtro.hashtag!.toLowerCase()))
      : posts;
    return {
      posts: await formatarVarios(tx, eu, filtrados),
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
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const [post] = await formatarVarios(tx, eu, [await exigirPost(tx, eu, postId)]);
    return post!;
  });
}

/** RF18: publicar no feed. Evento exige data de início (RN18). */
export async function publicar(
  ctx: Contexto,
  eu: Autenticado,
  dados: {
    categoria: Categoria;
    texto: string;
    imagemId?: string;
    eventoInicio?: Date;
    eventoLocal?: string;
    mencoes?: string[];
  },
) {
  const { post, avisos } = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirImagemPropria(tx, eu, dados.imagemId);
    const mencoes = await validarMencoes(tx, eu, dados.mencoes);
    const criado = await tx.post.create({
      data: { ...dados, mencoes, instituicaoId: eu.instituicaoId, autorId: eu.id },
      select: selecaoDoPost(eu),
    });
    const avisos = await notificar(
      tx,
      eu,
      mencoes.map((para) => ({
        para,
        tipo: 'MENCAO',
        postId: criado.id,
        texto: dados.texto,
      })),
    );
    const [post] = await formatarVarios(tx, eu, [criado]);
    return { post: post!, avisos };
  });
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:novo', { postId: post.id });
  avisar(ctx, avisos);
  return post;
}

/** Remove a publicação: o autor remove a sua; a coordenação, qualquer uma (com auditoria). */
export async function removerPost(ctx: Contexto, eu: Autenticado, postId: string) {
  await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const post = await exigirPost(tx, eu, postId);
    const ehAutor = post.autor.id === eu.id;
    if (!ehAutor && eu.papel !== 'COORDENACAO') {
      throw new ErroApp(403, 'sem_permissao', 'Só quem publicou pode remover.');
    }
    const { imagemId } = await tx.post.update({
      where: { id: postId },
      data: { removidoEm: new Date() },
      select: { imagemId: true },
    });
    // A imagem de uma publicação removida deixa de ser servida.
    if (imagemId) await tx.imagem.delete({ where: { id: imagemId } });
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
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:removido', { postId });
}

/** Totais da publicação, enviados à faculdade para os contadores mudarem sem recarregar. */
async function contagens(tx: Transacao, postId: string) {
  const [curtidas, comentarios, presencas] = await Promise.all([
    tx.curtidaPost.count({ where: { postId } }),
    tx.comentario.count({ where: { postId } }),
    tx.presencaEvento.count({ where: { postId } }),
  ]);
  return { postId, curtidas, comentarios, presencas };
}

/** RF19: curtir ou descurtir a publicação. Devolve o total atualizado. */
export async function curtirPost(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  curtir: boolean,
) {
  const { resposta, totais, avisos } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const post = await exigirPost(tx, eu, postId);
      let avisos: Awaited<ReturnType<typeof notificar>> = [];
      if (curtir) {
        const { count } = await tx.curtidaPost.createMany({
          data: [{ instituicaoId: eu.instituicaoId, postId, usuarioId: eu.id }],
          skipDuplicates: true,
        });
        if (count > 0) {
          avisos = await notificar(tx, eu, [
            { para: post.autor.id, tipo: 'POST_CURTIDO', postId, texto: post.texto },
          ]);
        }
      } else {
        await tx.curtidaPost.deleteMany({ where: { postId, usuarioId: eu.id } });
      }
      const totais = await contagens(tx, postId);
      return { resposta: { curti: curtir, curtidas: totais.curtidas }, totais, avisos };
    },
  );
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:atualizado', totais);
  avisar(ctx, avisos);
  return resposta;
}

/** RF20: confirmar ou desmarcar presença. Só em publicações de evento. */
export async function marcarPresenca(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  vou: boolean,
) {
  const { resposta, totais } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
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
      const totais = await contagens(tx, postId);
      return { resposta: { vou, presencas: totais.presencas }, totais };
    },
  );
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:atualizado', totais);
  return resposta;
}

function selecaoDoComentario(eu: Autenticado) {
  return {
    id: true,
    texto: true,
    criadoEm: true,
    paiId: true,
    mencoes: true,
    autor: AUTOR,
    curtidas: { where: { usuarioId: eu.id }, select: { usuarioId: true } },
    _count: { select: { curtidas: true } },
  } satisfies Prisma.ComentarioSelect;
}
type ComentarioDoBanco = Prisma.ComentarioGetPayload<{
  select: ReturnType<typeof selecaoDoComentario>;
}>;

function formatarComentario(
  { curtidas, _count, mencoes, ...c }: ComentarioDoBanco,
  eu: Autenticado,
  mapa: Map<string, Mencionado>,
) {
  return {
    ...c,
    mencoes: mencoes.flatMap((id) => (mapa.has(id) ? [mapa.get(id)!] : [])),
    curtidas: _count.curtidas,
    curti: curtidas.length > 0,
    meu: c.autor.id === eu.id,
  };
}

/**
 * RF19: comentários, do mais antigo para o mais novo, com as respostas logo
 * abaixo de cada um (um nível, como no Instagram).
 */
export function listarComentarios(ctx: Contexto, eu: Autenticado, postId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirPost(tx, eu, postId);
    const todos = await tx.comentario.findMany({
      where: { postId, autor: autorVisivel(eu) },
      orderBy: { criadoEm: 'asc' },
      take: 300,
      select: selecaoDoComentario(eu),
    });
    const mapa = await resolverMencoes(
      tx,
      eu,
      todos.flatMap((c) => c.mencoes),
    );
    const formatados = todos.map((c) => formatarComentario(c, eu, mapa));
    const ids = new Set(formatados.map((c) => c.id));
    return formatados
      .filter((c) => !c.paiId || !ids.has(c.paiId))
      .map((c) => ({ ...c, respostas: formatados.filter((r) => r.paiId === c.id) }));
  });
}

export async function comentar(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  dados: { texto: string; paiId?: string; mencoes?: string[] },
) {
  const { comentario, totais, avisos } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const post = await exigirPost(tx, eu, postId);
      // Resposta de resposta vira resposta do comentário de cima (um nível só).
      let pai: { id: string; autorId: string } | null = null;
      if (dados.paiId) {
        const alvo = await tx.comentario.findFirst({
          where: { id: dados.paiId, postId },
          select: { id: true, paiId: true, autorId: true },
        });
        if (!alvo) throw naoEncontrado('Comentário não encontrado.');
        pai = alvo.paiId
          ? await tx.comentario.findUnique({
              where: { id: alvo.paiId },
              select: { id: true, autorId: true },
            })
          : alvo;
        // Quem é respondido recebe o aviso, mesmo se for a resposta de baixo.
        if (pai && alvo.autorId !== pai.autorId)
          pai = { id: pai.id, autorId: alvo.autorId };
      }
      const mencoes = await validarMencoes(tx, eu, dados.mencoes);
      const c = await tx.comentario.create({
        data: {
          instituicaoId: eu.instituicaoId,
          postId,
          autorId: eu.id,
          texto: dados.texto,
          paiId: pai?.id ?? null,
          mencoes,
        },
        select: selecaoDoComentario(eu),
      });
      const lista: NovaNotificacao[] = [
        ...(pai ? [{ para: pai.autorId, tipo: 'COMENTARIO_RESPONDIDO' as const }] : []),
        { para: post.autor.id, tipo: 'POST_COMENTADO' as const },
        ...mencoes.map((para) => ({ para, tipo: 'MENCAO' as const })),
      ].map((n) => ({ ...n, postId, comentarioId: c.id, texto: dados.texto }));
      const avisos = await notificar(tx, eu, lista);
      const mapa = await resolverMencoes(tx, eu, mencoes);
      return {
        comentario: { ...formatarComentario(c, eu, mapa), respostas: [] },
        totais: await contagens(tx, postId),
        avisos,
      };
    },
  );
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:atualizado', totais);
  avisar(ctx, avisos);
  return comentario;
}

/** Curtir ou descurtir um comentário. Devolve o total atualizado. */
export async function curtirComentario(
  ctx: Contexto,
  eu: Autenticado,
  comentarioId: string,
  curtir: boolean,
) {
  const { resposta, avisos } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const c = await tx.comentario.findFirst({
        where: { id: comentarioId, autor: autorVisivel(eu) },
        select: { id: true, postId: true, autorId: true, texto: true },
      });
      if (!c) throw naoEncontrado('Comentário não encontrado.');
      await exigirPost(tx, eu, c.postId);
      let avisos: Awaited<ReturnType<typeof notificar>> = [];
      if (curtir) {
        const { count } = await tx.curtidaComentario.createMany({
          data: [{ instituicaoId: eu.instituicaoId, comentarioId, usuarioId: eu.id }],
          skipDuplicates: true,
        });
        if (count > 0) {
          avisos = await notificar(tx, eu, [
            {
              para: c.autorId,
              tipo: 'COMENTARIO_CURTIDO',
              postId: c.postId,
              comentarioId,
              texto: c.texto,
            },
          ]);
        }
      } else {
        await tx.curtidaComentario.deleteMany({
          where: { comentarioId, usuarioId: eu.id },
        });
      }
      const curtidas = await tx.curtidaComentario.count({ where: { comentarioId } });
      return { resposta: { curti: curtir, curtidas }, avisos };
    },
  );
  avisar(ctx, avisos);
  return resposta;
}

/** Salvar ou tirar dos salvos (só a própria pessoa vê). */
export function salvarPost(
  ctx: Contexto,
  eu: Autenticado,
  postId: string,
  salvar: boolean,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirPost(tx, eu, postId);
    if (salvar) {
      await tx.postSalvo.createMany({
        data: [{ instituicaoId: eu.instituicaoId, usuarioId: eu.id, postId }],
        skipDuplicates: true,
      });
    } else {
      await tx.postSalvo.deleteMany({ where: { usuarioId: eu.id, postId } });
    }
    return { salvo: salvar };
  });
}

/** Hashtags de um texto, sem o # e em minúsculas ("#Cálculo" vira "cálculo"). */
export function hashtagsDe(texto: string) {
  return [...texto.matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{2,40})/gu)].map((m) =>
    m[1]!.toLowerCase(),
  );
}

/** Hashtags mais usadas na faculdade nos últimos 14 dias. */
export function hashtagsEmAlta(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const posts = await tx.post.findMany({
      where: {
        removidoEm: null,
        autor: autorVisivel(eu),
        criadoEm: { gte: new Date(Date.now() - 14 * 86_400_000) },
        texto: { contains: '#' },
      },
      select: { texto: true },
      orderBy: { criadoEm: 'desc' },
      take: 1000,
    });
    const contagem = new Map<string, number>();
    for (const p of posts) {
      for (const h of new Set(hashtagsDe(p.texto)))
        contagem.set(h, (contagem.get(h) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([hashtag, posts]) => ({ hashtag, posts }));
  });
}

/** O autor apaga o próprio comentário; a coordenação, qualquer um. */
export async function apagarComentario(
  ctx: Contexto,
  eu: Autenticado,
  comentarioId: string,
) {
  const totais = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const c = await tx.comentario.findUnique({
      where: { id: comentarioId },
      select: { autorId: true, postId: true },
    });
    if (!c) throw naoEncontrado('Comentário não encontrado.');
    if (c.autorId !== eu.id && eu.papel !== 'COORDENACAO') {
      throw new ErroApp(403, 'sem_permissao', 'Só quem comentou pode apagar.');
    }
    await tx.comentario.delete({ where: { id: comentarioId } });
    if (c.autorId !== eu.id) {
      await registrar(
        tx,
        eu,
        'comentario_removido',
        { tipo: 'comentario', id: comentarioId },
        { autorId: c.autorId, postId: c.postId },
      );
    }
    return contagens(tx, c.postId);
  });
  ctx.notificar.enviarFaculdade(eu.instituicaoId, 'post:atualizado', totais);
}

export type PostCompartilhado = {
  id: string;
  texto: string;
  imagemUrl: string | null;
  autor: { id: string; apelido: string; fotoUrl: string | null };
};

/** Prévia das publicações enviadas no chat (só as que a pessoa ainda pode ver). */
export async function postCompartilhado(tx: Transacao, eu: Autenticado, ids: string[]) {
  if (ids.length === 0) return new Map<string, PostCompartilhado>();
  const posts = await tx.post.findMany({
    where: { id: { in: [...new Set(ids)] }, removidoEm: null, autor: autorVisivel(eu) },
    select: {
      id: true,
      texto: true,
      imagemId: true,
      autor: { select: { id: true, apelido: true, fotoUrl: true } },
    },
  });
  return new Map(
    posts.map(({ imagemId, ...p }) => [
      p.id,
      { ...p, texto: p.texto.slice(0, 200), imagemUrl: urlDaImagem(imagemId) },
    ]),
  );
}
