import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import { naFaculdade, type Transacao } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp } from '../../erros';
import { conferir, gerarHash } from '../../seguranca/senha';
import {
  assinarAcesso,
  DURACAO_ACESSO_SEGUNDOS,
  faculdadeDaRenovacao,
  gerarRenovacao,
  hashRenovacao,
  validadeRenovacao,
} from '../../seguranca/tokens';
import { PERFIL_PROPRIO } from '../perfil/servico';
import type * as esquemas from './esquemas';

const VALIDADE_CODIGO_MS = 10 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;
export const MAX_TENTATIVAS = 5;

const credenciaisInvalidas = () =>
  new ErroApp(401, 'credenciais_invalidas', 'E-mail ou senha incorretos.');
const sessaoInvalida = () =>
  new ErroApp(401, 'sessao_invalida', 'Sessão expirada ou inválida. Faça login novamente.');

/** Faculdade dona do domínio do e-mail (subdomínios valem). Só faculdades ativas. */
export async function faculdadeDoEmail(ctx: Contexto, email: string) {
  const dominio = email.split('@')[1] ?? '';
  const partes = dominio.split('.');
  // aluno.horizonte.edu.br → [aluno.horizonte.edu.br, horizonte.edu.br, edu.br]
  const sufixos = partes.slice(0, -1).map((_, i) => partes.slice(i).join('.'));
  const encontrados = await ctx.prisma.dominioEmail.findMany({
    where: { dominio: { in: sufixos }, instituicao: { ativa: true } },
    select: {
      dominio: true,
      instituicao: { select: { id: true, nome: true, sigla: true, corPrimaria: true } },
    },
  });
  encontrados.sort((a, b) => b.dominio.length - a.dominio.length);
  return encontrados[0]?.instituicao ?? null;
}

async function exigirFaculdade(ctx: Contexto, email: string) {
  const faculdade = await faculdadeDoEmail(ctx, email);
  if (!faculdade) {
    throw new ErroApp(
      422,
      'dominio_nao_aceito',
      'Este e-mail não é de uma faculdade parceira. Use o seu e-mail institucional.',
    );
  }
  return faculdade;
}

/** Abre uma sessão: grava o hash do token de renovação e devolve os dois tokens. */
async function abrirSessao(
  ctx: Contexto,
  tx: Transacao,
  usuarioId: string,
  dispositivo?: string,
) {
  const usuario = await tx.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: PERFIL_PROPRIO,
  });
  const renovacao = gerarRenovacao(usuario.instituicaoId);
  await tx.sessao.create({
    data: {
      instituicaoId: usuario.instituicaoId,
      usuarioId,
      refreshTokenHash: renovacao.hash,
      dispositivo,
      expiraEm: validadeRenovacao(),
    },
  });
  return {
    acessoToken: assinarAcesso(
      { id: usuario.id, instituicaoId: usuario.instituicaoId, papel: usuario.papel },
      ctx.segredoJwt,
    ),
    refreshToken: renovacao.token,
    expiraEmSegundos: DURACAO_ACESSO_SEGUNDOS,
    usuario,
  };
}

export type Sessao = Awaited<ReturnType<typeof abrirSessao>>;

/** RF: envia um código de 6 dígitos, válido por 10 minutos, ao e-mail institucional. */
export async function pedirCodigo(
  ctx: Contexto,
  { email }: z.infer<typeof esquemas.pedirCodigo>,
) {
  const faculdade = await exigirFaculdade(ctx, email);
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codigoHash = await gerarHash(codigo);

  await naFaculdade(ctx.prisma, faculdade.id, async (tx) => {
    if (await tx.usuario.findUnique({ where: { email }, select: { id: true } })) {
      throw new ErroApp(
        409,
        'email_ja_cadastrado',
        'Este e-mail já tem conta. Faça login.',
      );
    }
    const ultimo = await tx.codigoVerificacao.findFirst({
      where: { email },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    if (ultimo && Date.now() - ultimo.criadoEm.getTime() < INTERVALO_REENVIO_MS) {
      throw new ErroApp(
        429,
        'aguarde_reenvio',
        'Aguarde um minuto para pedir outro código.',
      );
    }
    await tx.codigoVerificacao.create({
      data: {
        instituicaoId: faculdade.id,
        email,
        codigoHash,
        expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MS),
      },
    });
  });

  await ctx.email.enviarCodigo(email, codigo, faculdade.nome);
  return faculdade;
}

/**
 * RF: cria a conta depois de conferir o código. Os erros de código são
 * devolvidos (e não lançados) dentro da transação para que o aumento do
 * número de tentativas seja gravado.
 */
export async function cadastrar(
  ctx: Contexto,
  dados: z.infer<typeof esquemas.cadastro>,
): Promise<Sessao> {
  const faculdade = await exigirFaculdade(ctx, dados.email);
  const senhaHash = await gerarHash(dados.senha);

  const resultado = await naFaculdade(ctx.prisma, faculdade.id, async (tx) => {
    const codigo = await tx.codigoVerificacao.findFirst({
      where: { email: dados.email, usadoEm: null },
      orderBy: { criadoEm: 'desc' },
    });
    if (!codigo || codigo.expiraEm < new Date()) {
      return new ErroApp(422, 'codigo_expirado', 'O código expirou. Peça um novo código.');
    }
    if (codigo.tentativas >= MAX_TENTATIVAS) {
      return new ErroApp(
        429,
        'codigo_bloqueado',
        'Muitas tentativas. Peça um novo código.',
      );
    }
    if (!(await conferir(dados.codigo, codigo.codigoHash))) {
      const { tentativas } = await tx.codigoVerificacao.update({
        where: { id: codigo.id },
        data: { tentativas: { increment: 1 } },
      });
      const restantes = MAX_TENTATIVAS - tentativas;
      return new ErroApp(
        422,
        'codigo_incorreto',
        restantes > 0
          ? `Código incorreto. Você ainda tem ${restantes} tentativa(s).`
          : 'Código incorreto. Peça um novo código.',
      );
    }
    await tx.codigoVerificacao.update({
      where: { id: codigo.id },
      data: { usadoEm: new Date() },
    });

    if (dados.cursoId && !(await tx.curso.findUnique({ where: { id: dados.cursoId } }))) {
      throw new ErroApp(422, 'curso_inexistente', 'Curso não encontrado.', {
        cursoId: 'Curso não encontrado',
      });
    }
    const usuario = await tx.usuario.create({
      data: {
        instituicaoId: faculdade.id,
        cursoId: dados.cursoId,
        nome: dados.nome,
        apelido: dados.apelido,
        email: dados.email,
        senhaHash,
        dataNascimento: dados.dataNascimento,
        emailVerificadoEm: new Date(),
      },
      select: { id: true },
    });
    return abrirSessao(ctx, tx, usuario.id, dados.dispositivo);
  });

  if (resultado instanceof ErroApp) throw resultado;
  return resultado;
}

/** RF: entra com e-mail institucional e senha. */
export async function entrar(
  ctx: Contexto,
  dados: z.infer<typeof esquemas.login>,
): Promise<Sessao> {
  const faculdade = await faculdadeDoEmail(ctx, dados.email);
  if (!faculdade) {
    await conferir(dados.senha, null); // mesmo tempo de resposta de um e-mail existente
    throw credenciaisInvalidas();
  }

  return naFaculdade(ctx.prisma, faculdade.id, async (tx) => {
    const conta = await tx.usuario.findUnique({
      where: { email: dados.email },
      select: { id: true, senhaHash: true, status: true },
    });
    if (
      !(await conferir(dados.senha, conta?.senhaHash)) ||
      !conta ||
      conta.status === 'EXCLUIDA'
    ) {
      throw credenciaisInvalidas();
    }
    if (conta.status === 'SUSPENSA') {
      throw new ErroApp(403, 'conta_suspensa', 'Sua conta está suspensa pela coordenação.');
    }
    return abrirSessao(ctx, tx, conta.id, dados.dispositivo);
  });
}

/**
 * RF: troca o token de renovação por um novo par (rotação). Se um token já
 * usado aparecer de novo, ele pode ter sido roubado: todas as sessões da
 * conta são encerradas.
 */
export async function renovar(ctx: Contexto, refreshToken: string): Promise<Sessao> {
  const faculdadeId = faculdadeDaRenovacao(refreshToken);
  const hash = hashRenovacao(refreshToken);

  const resultado = await naFaculdade(ctx.prisma, faculdadeId, async (tx) => {
    const sessao = await tx.sessao.findUnique({
      where: { refreshTokenHash: hash },
      include: { usuario: { select: { status: true } } },
    });
    if (!sessao) return sessaoInvalida();

    const agora = new Date();
    if (sessao.revogadaEm) {
      await tx.sessao.updateMany({
        where: { usuarioId: sessao.usuarioId, revogadaEm: null },
        data: { revogadaEm: agora },
      });
      return sessaoInvalida();
    }
    if (sessao.expiraEm < agora || sessao.usuario.status !== 'ATIVA')
      return sessaoInvalida();

    await tx.sessao.update({ where: { id: sessao.id }, data: { revogadaEm: agora } });
    return abrirSessao(ctx, tx, sessao.usuarioId, sessao.dispositivo ?? undefined);
  });

  if (resultado instanceof ErroApp) throw resultado;
  return resultado;
}

/** RF: sai da conta neste aparelho. Responde do mesmo jeito se o token não existir. */
export async function sair(ctx: Contexto, refreshToken: string): Promise<void> {
  let faculdadeId: string;
  try {
    faculdadeId = faculdadeDaRenovacao(refreshToken);
  } catch {
    return;
  }
  await naFaculdade(ctx.prisma, faculdadeId, (tx) =>
    tx.sessao.updateMany({
      where: { refreshTokenHash: hashRenovacao(refreshToken), revogadaEm: null },
      data: { revogadaEm: new Date() },
    }),
  );
}
