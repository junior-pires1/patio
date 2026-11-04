import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { exigirImagemPropria, urlDaImagem } from '../imagens/servico';
import { conexaoEntre, idsDasConexoes, PESSOA, visivelPara } from '../social/servico';

// Stories de 24 horas, vistos só pela própria pessoa e pelas conexões dela.
// Os destaques guardam stories antigos no perfil, com a mesma regra.

export const MAX_STORIES_POR_DIA = 20;
export const MAX_DESTAQUES = 20;
export const DIAS_NO_ARQUIVO = 30;

const STORY = {
  id: true,
  autorId: true,
  imagemId: true,
  legenda: true,
  criadoEm: true,
  expiraEm: true,
} as const;

type StoryDoBanco = {
  id: string;
  autorId: string;
  imagemId: string;
  legenda: string | null;
  criadoEm: Date;
  expiraEm: Date;
};

const formatar = ({ imagemId, ...s }: StoryDoBanco, vistos: Set<string>) => ({
  ...s,
  imagemUrl: urlDaImagem(imagemId)!,
  visto: vistos.has(s.id),
});

/**
 * Quem pode ver os stories (e destaques) da pessoa: ela mesma ou uma
 * conexão ativa, sem bloqueio e com a conta ativa.
 */
async function podeVer(tx: Transacao, eu: Autenticado, autorId: string) {
  if (autorId === eu.id) return true;
  const autor = await tx.usuario.findFirst({
    where: { AND: [{ id: autorId }, visivelPara(eu)] },
    select: { id: true },
  });
  return Boolean(autor && (await conexaoEntre(tx, eu.id, autorId)));
}

async function exigirStoryVisivel(tx: Transacao, eu: Autenticado, storyId: string) {
  const story = await tx.story.findUnique({ where: { id: storyId }, select: STORY });
  if (!story || !(await podeVer(tx, eu, story.autorId))) {
    throw naoEncontrado('Story não encontrado.');
  }
  return story;
}

/** Publica um story (imagem já enviada por POST /imagens). As conexões são avisadas. */
export async function publicarStory(
  ctx: Contexto,
  eu: Autenticado,
  dados: { imagemId: string; legenda?: string | null },
) {
  const { story, conexoes } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const ultimoDia = await tx.story.count({
        where: { autorId: eu.id, criadoEm: { gte: new Date(Date.now() - 86_400_000) } },
      });
      if (ultimoDia >= MAX_STORIES_POR_DIA) {
        throw new ErroApp(429, 'muitos_stories', 'Você já publicou muitos stories hoje.');
      }
      await exigirImagemPropria(tx, eu, dados.imagemId);
      // Arquivo de 30 dias: stories mais antigos que não estão em destaque saem com a imagem.
      await tx.imagem.deleteMany({
        where: {
          autorId: eu.id,
          stories: {
            some: {
              criadoEm: { lt: new Date(Date.now() - DIAS_NO_ARQUIVO * 86_400_000) },
              destaques: { none: {} },
            },
          },
        },
      });
      const criado = await tx.story.create({
        data: {
          instituicaoId: eu.instituicaoId,
          autorId: eu.id,
          imagemId: dados.imagemId,
          legenda: dados.legenda ?? null,
        },
        select: STORY,
      });
      return {
        story: formatar(criado, new Set()),
        conexoes: await idsDasConexoes(tx, eu.id),
      };
    },
  );
  ctx.notificar.enviar(conexoes, 'story:novo', { autorId: eu.id });
  return story;
}

/**
 * Stories das últimas 24 horas: os meus primeiro, depois as conexões com
 * story ainda não visto, depois as já vistas. Cada pessoa com os stories em ordem.
 */
export function listarStories(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const conexoes = await idsDasConexoes(tx, eu.id);
    const stories = await tx.story.findMany({
      where: {
        expiraEm: { gt: new Date() },
        OR: [{ autorId: eu.id }, { autorId: { in: conexoes }, autor: visivelPara(eu) }],
      },
      select: { ...STORY, autor: { select: PESSOA } },
      orderBy: { criadoEm: 'asc' },
    });
    const vistos = new Set(
      (
        await tx.storyVisualizacao.findMany({
          where: { usuarioId: eu.id, storyId: { in: stories.map((s) => s.id) } },
          select: { storyId: true },
        })
      ).map((v) => v.storyId),
    );

    const porAutor = new Map<
      string,
      { autor: (typeof stories)[number]['autor']; stories: ReturnType<typeof formatar>[] }
    >();
    for (const { autor, ...s } of stories) {
      const grupo = porAutor.get(autor.id) ?? { autor, stories: [] };
      grupo.stories.push(formatar(s, vistos));
      porAutor.set(autor.id, grupo);
    }
    return [...porAutor.values()]
      .map((g) => ({
        ...g,
        meu: g.autor.id === eu.id,
        todosVistos: g.autor.id === eu.id || g.stories.every((s) => s.visto),
      }))
      .sort((x, y) => {
        if (x.meu !== y.meu) return x.meu ? -1 : 1;
        if (x.todosVistos !== y.todosVistos) return x.todosVistos ? 1 : -1;
        const ultimo = (g: typeof x) => g.stories.at(-1)!.criadoEm.getTime();
        return ultimo(y) - ultimo(x);
      });
  });
}

/** Marca o story como visto (o autor vê quem viu). */
export function marcarVisto(ctx: Contexto, eu: Autenticado, storyId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const story = await exigirStoryVisivel(tx, eu, storyId);
    if (story.autorId === eu.id) return;
    await tx.storyVisualizacao.createMany({
      data: [{ instituicaoId: eu.instituicaoId, storyId, usuarioId: eu.id }],
      skipDuplicates: true,
    });
  });
}

/** Quem viu o meu story (só o autor). */
export function visualizacoes(ctx: Contexto, eu: Autenticado, storyId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const story = await tx.story.findFirst({
      where: { id: storyId, autorId: eu.id },
      select: { id: true },
    });
    if (!story) throw naoEncontrado('Story não encontrado.');
    const lista = await tx.storyVisualizacao.findMany({
      where: { storyId, usuario: { status: 'ATIVA' } },
      select: { vistoEm: true, usuario: { select: PESSOA } },
      orderBy: { vistoEm: 'desc' },
    });
    return lista.map((v) => ({ pessoa: v.usuario, vistoEm: v.vistoEm }));
  });
}

/** Apaga o story (some também dos destaques). A imagem vai junto. */
export function apagarStory(ctx: Contexto, eu: Autenticado, storyId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const story = await tx.story.findFirst({
      where: { id: storyId, autorId: eu.id },
      select: { imagemId: true },
    });
    if (!story) throw naoEncontrado('Story não encontrado.');
    // Apagar a imagem apaga o story (ON DELETE CASCADE), as visualizações e os destaques.
    await tx.imagem.delete({ where: { id: story.imagemId } });
  });
}

/** Meus stories, inclusive os que já passaram de 24 horas (para montar destaques). */
export function arquivo(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const stories = await tx.story.findMany({
      where: { autorId: eu.id },
      select: STORY,
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    return stories.map((s) => formatar(s, new Set()));
  });
}

// ───────────── Destaques ─────────────

async function exigirStoriesProprios(tx: Transacao, eu: Autenticado, ids: string[]) {
  const unicos = [...new Set(ids)];
  const total = await tx.story.count({ where: { id: { in: unicos }, autorId: eu.id } });
  if (total !== unicos.length) {
    throw new ErroApp(422, 'story_invalido', 'Algum story não foi encontrado.', {
      storyIds: 'Escolha só stories seus',
    });
  }
  return unicos;
}

/** Destaques de um aluno, com capa (o story mais recente) e total. */
export function destaquesDe(ctx: Contexto, eu: Autenticado, usuarioId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (!(await podeVer(tx, eu, usuarioId))) return [];
    const destaques = await tx.destaque.findMany({
      where: { usuarioId },
      select: {
        id: true,
        titulo: true,
        stories: {
          select: { story: { select: { imagemId: true } } },
          orderBy: { adicionadoEm: 'desc' },
          take: 1,
        },
        _count: { select: { stories: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });
    return destaques
      .filter((d) => d._count.stories > 0)
      .map((d) => ({
        id: d.id,
        titulo: d.titulo,
        capaUrl: urlDaImagem(d.stories[0]?.story.imagemId ?? null),
        total: d._count.stories,
      }));
  });
}

/** Abre um destaque: os stories dele em ordem. */
export function verDestaque(ctx: Contexto, eu: Autenticado, destaqueId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const destaque = await tx.destaque.findUnique({
      where: { id: destaqueId },
      select: {
        id: true,
        titulo: true,
        usuario: { select: PESSOA },
        stories: {
          select: { story: { select: STORY } },
          orderBy: { story: { criadoEm: 'asc' } },
        },
      },
    });
    if (!destaque || !(await podeVer(tx, eu, destaque.usuario.id))) {
      throw naoEncontrado('Destaque não encontrado.');
    }
    return {
      id: destaque.id,
      titulo: destaque.titulo,
      autor: destaque.usuario,
      meu: destaque.usuario.id === eu.id,
      stories: destaque.stories.map((d) => formatar(d.story, new Set())),
    };
  });
}

export function criarDestaque(
  ctx: Contexto,
  eu: Autenticado,
  dados: { titulo: string; storyIds: string[] },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if ((await tx.destaque.count({ where: { usuarioId: eu.id } })) >= MAX_DESTAQUES) {
      throw new ErroApp(422, 'limite_destaques', `No máximo ${MAX_DESTAQUES} destaques.`);
    }
    const ids = await exigirStoriesProprios(tx, eu, dados.storyIds);
    const destaque = await tx.destaque.create({
      data: { instituicaoId: eu.instituicaoId, usuarioId: eu.id, titulo: dados.titulo },
      select: { id: true, titulo: true },
    });
    await tx.destaqueStory.createMany({
      data: ids.map((storyId) => ({
        instituicaoId: eu.instituicaoId,
        destaqueId: destaque.id,
        storyId,
      })),
    });
    return { ...destaque, total: ids.length };
  });
}

/** Troca o título e/ou os stories do destaque. */
export function editarDestaque(
  ctx: Contexto,
  eu: Autenticado,
  destaqueId: string,
  dados: { titulo?: string; storyIds?: string[] },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const destaque = await tx.destaque.findFirst({
      where: { id: destaqueId, usuarioId: eu.id },
      select: { id: true },
    });
    if (!destaque) throw naoEncontrado('Destaque não encontrado.');
    if (dados.titulo) {
      await tx.destaque.update({
        where: { id: destaqueId },
        data: { titulo: dados.titulo },
      });
    }
    if (dados.storyIds) {
      const ids = await exigirStoriesProprios(tx, eu, dados.storyIds);
      await tx.destaqueStory.deleteMany({ where: { destaqueId } });
      await tx.destaqueStory.createMany({
        data: ids.map((storyId) => ({
          instituicaoId: eu.instituicaoId,
          destaqueId,
          storyId,
        })),
      });
    }
    return tx.destaque.findUniqueOrThrow({
      where: { id: destaqueId },
      select: { id: true, titulo: true, _count: { select: { stories: true } } },
    });
  });
}

export function apagarDestaque(ctx: Contexto, eu: Autenticado, destaqueId: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const { count } = await tx.destaque.deleteMany({
      where: { id: destaqueId, usuarioId: eu.id },
    });
    if (count === 0) throw naoEncontrado('Destaque não encontrado.');
  });
}
