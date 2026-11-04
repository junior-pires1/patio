import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { avisar, notificar, type Aviso } from '../notificacoes/servico';
import { colegasVisiveis, emOrdem } from '../conexoes/servico';
import { listarPosts } from '../feed/servico';
import { PERFIL_PUBLICO } from '../perfil/servico';

// Perfil social: o perfil é aberto para toda a faculdade (só a conversa
// depende da conexão), com publicações, experiências e recomendações.

export const TIPOS_DE_EXPERIENCIA = [
  'ESTAGIO',
  'EMPREGO',
  'PROJETO',
  'MONITORIA',
  'PESQUISA',
  'VOLUNTARIADO',
  'CURSO',
] as const;

const EXPERIENCIA = {
  id: true,
  tipo: true,
  titulo: true,
  organizacao: true,
  inicio: true,
  fim: true,
  descricao: true,
} satisfies Prisma.ExperienciaSelect;

/** Resumo de uma pessoa em listas (busca, curtidas, quem viu o story). */
export const PESSOA = {
  id: true,
  apelido: true,
  fotoUrl: true,
  frase: true,
  semestre: true,
  curso: { select: { nome: true } },
} satisfies Prisma.UsuarioSelect;

/** Visível para quem pergunta: a própria pessoa ou um colega ativo sem bloqueio. */
export function visivelPara(eu: Autenticado): Prisma.UsuarioWhereInput {
  return {
    papel: 'ALUNO',
    status: 'ATIVA',
    bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
    bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
  };
}

/** Conexão ativa entre duas pessoas (o match que libera o chat). */
export async function conexaoEntre(tx: Transacao, x: string, y: string) {
  if (x === y) return null;
  const [usuarioAId, usuarioBId] = emOrdem(x, y);
  return tx.match.findFirst({
    where: { usuarioAId, usuarioBId, desfeitoEm: null },
    select: { id: true },
  });
}

/** Ids das conexões ativas da pessoa. */
export async function idsDasConexoes(tx: Transacao, euId: string) {
  const matches = await tx.match.findMany({
    where: { desfeitoEm: null, OR: [{ usuarioAId: euId }, { usuarioBId: euId }] },
    select: { usuarioAId: true, usuarioBId: true },
  });
  return matches.map((m) => (m.usuarioAId === euId ? m.usuarioBId : m.usuarioAId));
}

/**
 * Perfil completo de um aluno: dados públicos, links, experiências,
 * habilidades com recomendações, números e a relação com quem está vendo.
 */
export function perfilCompleto(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const perfil = await tx.usuario.findFirst({
      where: { AND: [{ id }, visivelPara(eu)] },
      select: {
        ...PERFIL_PUBLICO,
        experiencias: { select: EXPERIENCIA, orderBy: [{ inicio: 'desc' }] },
      },
    });
    if (!perfil) throw naoEncontrado('Perfil não encontrado.');

    const [publicacoes, conexoes, endossos, conexao, euCurti, meCurtiu] = await Promise.all(
      [
        tx.post.count({ where: { autorId: id, removidoEm: null } }),
        tx.match.count({
          where: {
            desfeitoEm: null,
            OR: [{ usuarioAId: id }, { usuarioBId: id }],
          },
        }),
        tx.endosso.findMany({
          where: { usuarioId: id, autor: { status: 'ATIVA' } },
          select: { habilidade: true, autorId: true },
        }),
        conexaoEntre(tx, eu.id, id),
        tx.curtida.count({ where: { deId: eu.id, paraId: id } }),
        tx.curtida.count({ where: { deId: id, paraId: eu.id } }),
      ],
    );

    const habilidades = perfil.habilidades.map((habilidade) => {
      const deste = endossos.filter((e) => e.habilidade === habilidade);
      return {
        habilidade,
        recomendacoes: deste.length,
        euRecomendei: deste.some((e) => e.autorId === eu.id),
      };
    });
    return {
      ...perfil,
      habilidadesRecomendadas: habilidades,
      contadores: {
        publicacoes,
        conexoes,
        recomendacoes: endossos.length,
      },
      relacao: {
        souEu: id === eu.id,
        conexaoId: conexao?.id ?? null,
        euCurti: euCurti > 0,
        meCurtiu: meCurtiu > 0,
      },
    };
  });
}

/** Publicações de um aluno, das mais novas para as mais antigas (grade do perfil). */
export async function postsDoUsuario(
  ctx: Contexto,
  eu: Autenticado,
  id: string,
  antes?: Date,
) {
  const visivel = await naFaculdade(ctx.prisma, eu.instituicaoId, (tx) =>
    tx.usuario.count({ where: { AND: [{ id }, visivelPara(eu)] } }),
  );
  if (!visivel) throw naoEncontrado('Perfil não encontrado.');
  return listarPosts(ctx, eu, { autorId: id, antes });
}

// ───────────── Experiências (estilo LinkedIn) ─────────────

export type DadosExperiencia = {
  tipo: (typeof TIPOS_DE_EXPERIENCIA)[number];
  titulo: string;
  organizacao?: string | null;
  inicio: Date;
  fim?: Date | null;
  descricao?: string | null;
};

export function criarExperiencia(ctx: Contexto, eu: Autenticado, dados: DadosExperiencia) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const total = await tx.experiencia.count({ where: { usuarioId: eu.id } });
    if (total >= 30) {
      throw new ErroApp(422, 'limite_experiencias', 'No máximo 30 experiências.');
    }
    return tx.experiencia.create({
      data: { ...dados, instituicaoId: eu.instituicaoId, usuarioId: eu.id },
      select: EXPERIENCIA,
    });
  });
}

export function editarExperiencia(
  ctx: Contexto,
  eu: Autenticado,
  id: string,
  dados: DadosExperiencia,
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const { count } = await tx.experiencia.updateMany({
      where: { id, usuarioId: eu.id },
      data: dados,
    });
    if (count === 0) throw naoEncontrado('Experiência não encontrada.');
    return tx.experiencia.findUniqueOrThrow({ where: { id }, select: EXPERIENCIA });
  });
}

export function removerExperiencia(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const { count } = await tx.experiencia.deleteMany({ where: { id, usuarioId: eu.id } });
    if (count === 0) throw naoEncontrado('Experiência não encontrada.');
  });
}

// ───────────── Recomendações de habilidades ─────────────

/**
 * Recomendar (ou tirar a recomendação de) uma habilidade do colega. Como no
 * LinkedIn, só quem é conexão recomenda, e só habilidades que a pessoa colocou no perfil.
 */
export async function recomendar(
  ctx: Contexto,
  eu: Autenticado,
  usuarioId: string,
  habilidade: string,
  recomendar: boolean,
) {
  const { avisos, ...resposta } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const alvo = await tx.usuario.findFirst({
        where: { AND: [{ id: usuarioId }, colegasVisiveis(eu.id)] },
        select: { habilidades: true },
      });
      if (!alvo) throw naoEncontrado('Perfil não encontrado.');
      if (!(await conexaoEntre(tx, eu.id, usuarioId))) {
        throw new ErroApp(
          403,
          'so_conexoes',
          'Só conexões podem recomendar habilidades. Curtam um ao outro primeiro.',
        );
      }
      if (!alvo.habilidades.includes(habilidade)) {
        throw new ErroApp(
          422,
          'habilidade_inexistente',
          'Essa habilidade não está no perfil.',
          {
            habilidade: 'Habilidade não está no perfil',
          },
        );
      }
      let avisos: Aviso[] = [];
      if (recomendar) {
        const { count } = await tx.endosso.createMany({
          data: [
            { instituicaoId: eu.instituicaoId, usuarioId, autorId: eu.id, habilidade },
          ],
          skipDuplicates: true,
        });
        if (count > 0) {
          avisos = await notificar(tx, eu, [
            { para: usuarioId, tipo: 'RECOMENDACAO', texto: habilidade },
          ]);
        }
      } else {
        await tx.endosso.deleteMany({ where: { usuarioId, autorId: eu.id, habilidade } });
      }
      return {
        avisos,
        habilidade,
        recomendacoes: await tx.endosso.count({ where: { usuarioId, habilidade } }),
        euRecomendei: recomendar,
      };
    },
  );
  avisar(ctx, avisos);
  return resposta;
}

// ───────────── Busca ─────────────

const POR_BUSCA = 20;

/**
 * Busca de pessoas (apelido, curso, habilidades, interesses e disciplinas),
 * publicações (texto) e grupos (nome, descrição e disciplina). O nome
 * completo não entra: ele não aparece no perfil público.
 */
export async function buscar(
  ctx: Contexto,
  eu: Autenticado,
  { q, tipo }: { q: string; tipo: 'tudo' | 'pessoas' | 'posts' | 'grupos' },
) {
  const termo = q.trim();
  const padrao = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const quer = (t: string) => tipo === 'tudo' || tipo === t;

  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    let pessoas: unknown[] = [];
    if (quer('pessoas')) {
      const encontrados = await tx.$queryRaw<{ id: string }[]>`
        SELECT u.id FROM usuarios u
        LEFT JOIN cursos c ON c.id = u.curso_id
        WHERE u.papel = 'ALUNO' AND u.status = 'ATIVA' AND u.id <> ${eu.id}::uuid
          AND (
            u.apelido ILIKE ${padrao}
            OR c.nome ILIKE ${padrao}
            OR EXISTS (SELECT 1 FROM unnest(u.habilidades || u.interesses) h WHERE h ILIKE ${padrao})
            OR EXISTS (
              SELECT 1 FROM usuario_disciplinas ud JOIN disciplinas d ON d.id = ud.disciplina_id
              WHERE ud.usuario_id = u.id AND d.nome ILIKE ${padrao}
            )
          )
        ORDER BY u.apelido
        LIMIT ${POR_BUSCA}`;
      pessoas = await tx.usuario.findMany({
        where: {
          AND: [{ id: { in: encontrados.map((e) => e.id) } }, colegasVisiveis(eu.id)],
        },
        select: { ...PESSOA, habilidades: true },
        orderBy: { apelido: 'asc' },
      });
    }

    const grupos = quer('grupos')
      ? await tx.grupoEstudo.findMany({
          where: {
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { descricao: { contains: termo, mode: 'insensitive' } },
              { disciplina: { nome: { contains: termo, mode: 'insensitive' } } },
            ],
          },
          select: {
            id: true,
            nome: true,
            vagas: true,
            disciplina: { select: { nome: true } },
            _count: { select: { membros: true } },
          },
          orderBy: { criadoEm: 'desc' },
          take: POR_BUSCA,
        })
      : [];

    return {
      pessoas,
      grupos: grupos.map(({ _count, ...g }) => ({ ...g, membros: _count.membros })),
    };
  }).then(async (r) => ({
    ...r,
    posts: quer('posts') ? (await listarPosts(ctx, eu, { texto: termo })).posts : [],
  }));
}

// ───────────── Atividade: histórico de curtidas ─────────────

/** Pessoas que eu curti, das mais recentes para as mais antigas. */
export function curtidasFeitas(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const curtidas = await tx.curtida.findMany({
      where: { deId: eu.id, para: colegasVisiveis(eu.id) },
      select: { criadoEm: true, para: { select: PESSOA } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    const conexoes = new Set(await idsDasConexoes(tx, eu.id));
    return curtidas.map((c) => ({
      pessoa: c.para,
      curtidoEm: c.criadoEm,
      conexao: conexoes.has(c.para.id),
    }));
  });
}

/** Quem me curtiu e ainda espera resposta (curtir de volta vira conexão). */
export function curtidasRecebidas(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const curtidas = await tx.curtida.findMany({
      where: {
        paraId: eu.id,
        de: {
          ...colegasVisiveis(eu.id),
          curtidasRecebidas: { none: { deId: eu.id } },
        },
      },
      select: { criadoEm: true, de: { select: PESSOA } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    return curtidas.map((c) => ({ pessoa: c.de, curtidoEm: c.criadoEm }));
  });
}

/**
 * Desfaz a curtida em alguém. Se já viraram conexão, é preciso desfazer a
 * conexão (no chat): a curtida sozinha não sai.
 */
export async function descurtirPessoa(ctx: Contexto, eu: Autenticado, paraId: string) {
  const total = await naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (await conexaoEntre(tx, eu.id, paraId)) {
      throw new ErroApp(
        409,
        'ja_conectados',
        'Vocês já são conexão. Para desfazer, use "Desfazer conexão" na conversa.',
      );
    }
    const { count } = await tx.curtida.deleteMany({ where: { deId: eu.id, paraId } });
    if (count === 0) throw naoEncontrado('Curtida não encontrada.');
    return tx.curtida.count({
      where: {
        paraId,
        de: {
          ...colegasVisiveis(paraId),
          curtidasRecebidas: { none: { deId: paraId } },
          recusasRecebidas: { none: { deId: paraId } },
        },
      },
    });
  });
  // O número de curtidas no ícone da outra pessoa diminui.
  ctx.notificar.enviar([paraId], 'curtidas:atualizadas', { total });
}

/** Publicações que curti. */
export function postsCurtidos(ctx: Contexto, eu: Autenticado, antes?: Date) {
  return listarPosts(ctx, eu, { curtidoPor: eu.id, antes });
}
