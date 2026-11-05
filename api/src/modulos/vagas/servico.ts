import { semCuringas } from '../../banco/busca';
import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Prisma } from '../../generated/prisma/client';
import type { Autenticado } from '../../seguranca/tokens';
import { avisar, notificar } from '../notificacoes/servico';

// Vagas e oportunidades (estilo LinkedIn): estágio, monitoria, iniciação
// científica, projetos. Qualquer aluno ou a coordenação publica; alunos se candidatam.

export const TIPOS_DE_VAGA = [
  'ESTAGIO',
  'MONITORIA',
  'PESQUISA',
  'PROJETO',
  'EMPREGO',
  'VOLUNTARIADO',
] as const;
export const MODALIDADES = ['PRESENCIAL', 'REMOTO', 'HIBRIDO'] as const;
export const STATUS_DA_CANDIDATURA = [
  'ENVIADA',
  'EM_ANALISE',
  'APROVADA',
  'RECUSADA',
] as const;
export type StatusCandidatura = (typeof STATUS_DA_CANDIDATURA)[number];

const ROTULO_STATUS: Record<StatusCandidatura, string> = {
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Não seguiu',
};

const AUTOR = {
  id: true,
  apelido: true,
  fotoUrl: true,
  papel: true,
  curso: { select: { nome: true } },
} satisfies Prisma.UsuarioSelect;

const CANDIDATO = {
  id: true,
  apelido: true,
  fotoUrl: true,
  frase: true,
  semestre: true,
  curso: { select: { nome: true } },
} satisfies Prisma.UsuarioSelect;

/** Autor que a pessoa pode ver: conta ativa e sem bloqueio (a coordenação vê tudo). */
function autorVisivel(eu: Autenticado): Prisma.UsuarioWhereInput {
  if (eu.papel === 'COORDENACAO') return {};
  return {
    status: 'ATIVA',
    bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
    bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
  };
}

const hoje = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

function abertaAgora(): Prisma.VagaWhereInput {
  return { encerradaEm: null, OR: [{ prazo: null }, { prazo: { gte: hoje() } }] };
}

function selecao(eu: Autenticado) {
  return {
    id: true,
    tipo: true,
    titulo: true,
    organizacao: true,
    descricao: true,
    local: true,
    modalidade: true,
    link: true,
    prazo: true,
    criadoEm: true,
    encerradaEm: true,
    autor: { select: AUTOR },
    candidaturas: {
      where: { usuarioId: eu.id },
      select: { status: true, criadoEm: true },
    },
    _count: { select: { candidaturas: true } },
  } satisfies Prisma.VagaSelect;
}

type VagaBruta = Prisma.VagaGetPayload<{ select: ReturnType<typeof selecao> }>;

function formatar(v: VagaBruta, eu: Autenticado) {
  const { candidaturas, _count, ...resto } = v;
  const minha = v.autor.id === eu.id;
  const venceu = v.prazo !== null && v.prazo < hoje();
  return {
    ...resto,
    prazo: v.prazo ? v.prazo.toISOString().slice(0, 10) : null,
    aberta: v.encerradaEm === null && !venceu,
    minha,
    podeGerenciar: minha || eu.papel === 'COORDENACAO',
    minhaCandidatura: candidaturas[0] ?? null,
    // Quantos se candidataram só aparece para quem gerencia a vaga.
    candidatos: minha || eu.papel === 'COORDENACAO' ? _count.candidaturas : null,
  };
}

export type FiltroVagas = {
  tipo?: (typeof TIPOS_DE_VAGA)[number];
  modalidade?: (typeof MODALIDADES)[number];
  q?: string;
  lado: 'abertas' | 'minhas' | 'candidaturas';
};

/** Lista de vagas: abertas (padrão), as que publiquei ou as que me candidatei. */
export function listarVagas(ctx: Contexto, eu: Autenticado, filtro: FiltroVagas) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    // AND: a busca e "aberta agora" usam OR; num objeto só, um apagaria o outro.
    const where: Prisma.VagaWhereInput = {
      AND: [filtro.lado === 'abertas' ? abertaAgora() : {}],
      autor: autorVisivel(eu),
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.modalidade ? { modalidade: filtro.modalidade } : {}),
      ...(filtro.q
        ? {
            OR: [
              { titulo: { contains: semCuringas(filtro.q), mode: 'insensitive' } },
              { organizacao: { contains: semCuringas(filtro.q), mode: 'insensitive' } },
              { descricao: { contains: semCuringas(filtro.q), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filtro.lado === 'minhas' ? { autorId: eu.id } : {}),
      ...(filtro.lado === 'candidaturas'
        ? { candidaturas: { some: { usuarioId: eu.id } } }
        : {}),
    };
    const vagas = await tx.vaga.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: selecao(eu),
    });
    return vagas.map((v) => formatar(v, eu));
  });
}

export type DadosVaga = {
  tipo: (typeof TIPOS_DE_VAGA)[number];
  titulo: string;
  organizacao?: string | null;
  descricao: string;
  local?: string | null;
  modalidade: (typeof MODALIDADES)[number];
  link?: string | null;
  prazo?: Date | null;
};

/** Publica uma vaga (aluno ou coordenação). */
export function criarVaga(ctx: Contexto, eu: Autenticado, dados: DadosVaga) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const abertas = await tx.vaga.count({ where: { autorId: eu.id, ...abertaAgora() } });
    if (abertas >= 20) {
      throw new ErroApp(
        422,
        'limite_vagas',
        'Você já tem 20 vagas abertas. Encerre alguma.',
      );
    }
    const v = await tx.vaga.create({
      data: { ...dados, instituicaoId: eu.instituicaoId, autorId: eu.id },
      select: selecao(eu),
    });
    return formatar(v, eu);
  });
}

async function vagaVisivel(tx: Transacao, eu: Autenticado, id: string) {
  const v = await tx.vaga.findFirst({
    where: { id, autor: autorVisivel(eu) },
    select: selecao(eu),
  });
  if (!v) throw naoEncontrado('Vaga não encontrada.');
  return v;
}

/** Detalhe de uma vaga. */
export function verVaga(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) =>
    formatar(await vagaVisivel(tx, eu, id), eu),
  );
}

async function vagaQueGerencio(tx: Transacao, eu: Autenticado, id: string) {
  const v = await vagaVisivel(tx, eu, id);
  if (v.autor.id !== eu.id && eu.papel !== 'COORDENACAO') {
    throw new ErroApp(403, 'sem_permissao', 'Só quem publicou pode gerenciar a vaga.');
  }
  return v;
}

/** Encerra a vaga (quem publicou ou a coordenação). */
export function encerrarVaga(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const atual = await vagaQueGerencio(tx, eu, id);
    // Encerrar de novo não muda a data em que ela foi encerrada.
    if (atual.encerradaEm) return formatar(atual, eu);
    const v = await tx.vaga.update({
      where: { id },
      data: { encerradaEm: new Date() },
      select: selecao(eu),
    });
    return formatar(v, eu);
  });
}

/** Candidatar-se a uma vaga aberta, com uma mensagem opcional. */
export async function candidatar(
  ctx: Contexto,
  eu: Autenticado,
  id: string,
  mensagem: string | null,
) {
  const { resposta, avisos } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const v = formatar(await vagaVisivel(tx, eu, id), eu);
      if (v.minha) {
        throw new ErroApp(422, 'vaga_propria', 'Você não pode se candidatar à sua vaga.');
      }
      if (!v.aberta)
        throw new ErroApp(422, 'vaga_encerrada', 'Esta vaga já foi encerrada.');
      if (v.minhaCandidatura) {
        throw new ErroApp(409, 'ja_candidatou', 'Você já se candidatou a esta vaga.');
      }
      const c = await tx.candidatura.create({
        data: { instituicaoId: eu.instituicaoId, vagaId: id, usuarioId: eu.id, mensagem },
        select: { status: true, criadoEm: true },
      });
      const avisos = await notificar(tx, eu, [
        { para: v.autor.id, tipo: 'CANDIDATURA_NOVA', vagaId: id, texto: v.titulo },
      ]);
      return { resposta: c, avisos };
    },
  );
  avisar(ctx, avisos);
  return resposta;
}

/** Desistir da candidatura. */
export function desistir(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const { count } = await tx.candidatura.deleteMany({
      where: { vagaId: id, usuarioId: eu.id },
    });
    if (!count) throw naoEncontrado('Candidatura não encontrada.');
  });
}

/** Quem se candidatou (só quem gerencia a vaga). */
export function candidatosDaVaga(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await vagaQueGerencio(tx, eu, id);
    return tx.candidatura.findMany({
      where: {
        vagaId: id,
        usuario: {
          status: 'ATIVA',
          bloqueiosFeitos: { none: { bloqueadoId: eu.id } },
          bloqueiosRecebidos: { none: { bloqueadorId: eu.id } },
        },
      },
      orderBy: { criadoEm: 'asc' },
      take: 300,
      select: {
        mensagem: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
        usuario: { select: CANDIDATO },
      },
    });
  });
}

/** Muda o status de uma candidatura e avisa quem se candidatou. */
export async function atualizarCandidatura(
  ctx: Contexto,
  eu: Autenticado,
  id: string,
  usuarioId: string,
  status: StatusCandidatura,
) {
  const { resposta, avisos } = await naFaculdade(
    ctx.prisma,
    eu.instituicaoId,
    async (tx) => {
      const v = await vagaQueGerencio(tx, eu, id);
      const atual = await tx.candidatura.findUnique({
        where: { vagaId_usuarioId: { vagaId: id, usuarioId } },
        select: { status: true },
      });
      if (!atual) throw naoEncontrado('Candidatura não encontrada.');
      const c = await tx.candidatura.update({
        where: { vagaId_usuarioId: { vagaId: id, usuarioId } },
        data: { status, atualizadoEm: new Date() },
        select: { status: true, atualizadoEm: true },
      });
      const avisos =
        atual.status === status
          ? []
          : await notificar(tx, eu, [
              {
                para: usuarioId,
                tipo: 'CANDIDATURA_ATUALIZADA',
                vagaId: id,
                texto: `${v.titulo}: ${ROTULO_STATUS[status]}`,
              },
            ]);
      return { resposta: c, avisos };
    },
  );
  avisar(ctx, avisos);
  return resposta;
}
