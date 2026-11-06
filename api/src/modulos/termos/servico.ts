import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import type { Autenticado } from '../../seguranca/tokens';
import { registrar } from '../coordenacao/auditoria';
import { modeloDoTermo } from './modelo';

// Termo de uso e privacidade (LGPD) de cada faculdade. A versão 1 é o modelo
// padrão (gerado com o nome da faculdade); a coordenação publica as seguintes.

export type TermoAtual = {
  versao: number;
  texto: string;
  /** null quando é o modelo padrão (nunca publicado pela coordenação). */
  publicadoEm: Date | null;
  padrao: boolean;
  faculdade: { nome: string; sigla: string };
};

export async function termoAtual(
  tx: Transacao,
  instituicaoId: string,
): Promise<TermoAtual> {
  const faculdade = await tx.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { nome: true, sigla: true, ativa: true },
  });
  if (!faculdade || !faculdade.ativa) throw naoEncontrado('Faculdade não encontrada.');
  const ultimo = await tx.termo.findFirst({
    where: { instituicaoId },
    orderBy: { versao: 'desc' },
    select: { versao: true, texto: true, publicadoEm: true },
  });
  const nomes = { nome: faculdade.nome, sigla: faculdade.sigla };
  if (!ultimo) {
    return {
      versao: 1,
      texto: modeloDoTermo(nomes),
      publicadoEm: null,
      padrao: true,
      faculdade: nomes,
    };
  }
  return { ...ultimo, padrao: false, faculdade: nomes };
}

/** Confere se a versão que a pessoa aceitou é a atual (alguém pode ter publicado outra). */
export async function exigirVersaoAtual(
  tx: Transacao,
  instituicaoId: string,
  versao: number,
) {
  const atual = await termoAtual(tx, instituicaoId);
  if (atual.versao !== versao) {
    throw new ErroApp(
      409,
      'termo_desatualizado',
      'O termo foi atualizado agora há pouco. Leia a nova versão e aceite de novo.',
      { termo: 'Leia a nova versão do termo' },
    );
  }
}

/** Termo atual da faculdade (público: aparece no cadastro, antes de ter conta). */
export function termoPublico(ctx: Contexto, instituicaoId: string) {
  return naFaculdade(ctx.prisma, instituicaoId, (tx) => termoAtual(tx, instituicaoId));
}

/** O termo atual e o que a própria pessoa aceitou. */
export function meuTermo(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const atual = await termoAtual(tx, eu.instituicaoId);
    const conta = await tx.usuario.findUniqueOrThrow({
      where: { id: eu.id },
      select: { termoVersao: true, termoAceitoEm: true, termoPendente: true },
    });
    return {
      atual,
      aceito: conta.termoVersao
        ? { versao: conta.termoVersao, em: conta.termoAceitoEm }
        : null,
      pendente: conta.termoPendente,
    };
  });
}

/** Aceita a versão atual do termo (libera o app para quem estava pendente). */
export function aceitarTermo(ctx: Contexto, eu: Autenticado, versao: number) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    await exigirVersaoAtual(tx, eu.instituicaoId, versao);
    const aceitoEm = new Date();
    await tx.usuario.update({
      where: { id: eu.id },
      data: { termoVersao: versao, termoAceitoEm: aceitoEm, termoPendente: false },
    });
    return { versao, aceitoEm };
  });
}

// ───────────── Coordenação ─────────────

/** Termo atual, versões anteriores e quantos alunos aceitaram a versão atual. */
export function termoDaCoordenacao(ctx: Contexto, eu: Autenticado) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const atual = await termoAtual(tx, eu.instituicaoId);
    const [versoes, aceitaram, alunos] = await Promise.all([
      tx.termo.findMany({
        orderBy: { versao: 'desc' },
        select: { versao: true, publicadoEm: true, autor: { select: { apelido: true } } },
      }),
      tx.usuario.count({ where: { papel: 'ALUNO', termoVersao: atual.versao } }),
      tx.usuario.count({
        where: { papel: 'ALUNO', status: { in: ['ATIVA', 'SUSPENSA'] } },
      }),
    ]);
    return { atual, versoes, aceitaram, alunos };
  });
}

/** Texto de uma versão (para conferir o que foi aceito). */
export function versaoDoTermo(ctx: Contexto, eu: Autenticado, versao: number) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (versao === 1) {
      const atual = await termoAtual(tx, eu.instituicaoId);
      return { versao: 1, texto: modeloDoTermo(atual.faculdade), publicadoEm: null };
    }
    const termo = await tx.termo.findUnique({
      where: { instituicaoId_versao: { instituicaoId: eu.instituicaoId, versao } },
      select: { versao: true, texto: true, publicadoEm: true },
    });
    if (!termo) throw naoEncontrado('Versão não encontrada.');
    return termo;
  });
}

/** Publica um texto novo: vira a próxima versão (vale para os próximos cadastros). */
export function publicarTermo(ctx: Contexto, eu: Autenticado, texto: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    // Trava a faculdade: duas publicações ao mesmo tempo não disputam o número da versão.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`termo:${eu.instituicaoId}`}, 0))`;
    const atual = await termoAtual(tx, eu.instituicaoId);
    if (atual.texto.trim() === texto.trim()) {
      throw new ErroApp(422, 'termo_igual', 'O texto é igual ao da versão atual.', {
        texto: 'Altere o texto antes de publicar',
      });
    }
    const novo = await tx.termo.create({
      data: {
        instituicaoId: eu.instituicaoId,
        versao: atual.versao + 1,
        texto: texto.trim(),
        autorId: eu.id,
      },
      select: { versao: true, publicadoEm: true },
    });
    await registrar(
      tx,
      eu,
      'termo_publicado',
      { tipo: 'termo', id: eu.instituicaoId },
      {
        versao: novo.versao,
      },
    );
    return novo;
  });
}
