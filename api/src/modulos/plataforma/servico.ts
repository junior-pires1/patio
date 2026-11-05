import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import { conferir, gerarHash, senhaProvisoria } from '../../seguranca/senha';
import { assinarPlataforma, DURACAO_PLATAFORMA_SEGUNDOS } from './acesso';

// As consultas daqui rodam como dono do banco (fora do RLS): são da
// plataforma, não de uma faculdade. RN17: só totais, nunca dados de alunos.

/** Provedores de e-mail de qualquer pessoa e sufixos genéricos: nunca são de uma faculdade só. */
const DOMINIOS_PUBLICOS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.com.br',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'ig.com.br',
  'zipmail.com.br',
  'r7.com',
  'gmx.com',
]);
const SUFIXOS_GENERICOS = new Set([
  'br',
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'com.br',
  'edu.br',
  'org.br',
  'net.br',
  'gov.br',
  'art.br',
  'ind.br',
]);
export const dominioPublico = (d: string) =>
  DOMINIOS_PUBLICOS.has(d) || SUFIXOS_GENERICOS.has(d);

const credenciaisInvalidas = () =>
  new ErroApp(401, 'credenciais_invalidas', 'E-mail ou senha incorretos.');

/** RF34: entrar no painel da plataforma. */
export async function entrar(ctx: Contexto, email: string, senha: string) {
  const admin = await ctx.prisma.administrador.findUnique({ where: { email } });
  if (!(await conferir(senha, admin?.senhaHash)) || !admin) throw credenciaisInvalidas();
  return {
    acessoToken: assinarPlataforma(admin.id, ctx.segredoJwt),
    expiraEmSegundos: DURACAO_PLATAFORMA_SEGUNDOS,
    administrador: { id: admin.id, nome: admin.nome, email: admin.email },
  };
}

/** RF35/RF36: faculdades com domínios e totais (sem dados pessoais). */
export async function listarFaculdades(ctx: Contexto) {
  const faculdades = await ctx.prisma.instituicao.findMany({
    orderBy: { nome: 'asc' },
    include: {
      dominios: { select: { dominio: true }, orderBy: { dominio: 'asc' } },
      usuarios: { where: { papel: 'COORDENACAO' }, select: { email: true } },
      _count: { select: { usuarios: { where: { papel: 'ALUNO', status: 'ATIVA' } } } },
    },
  });
  return faculdades.map(({ dominios, usuarios, _count, ...f }) => ({
    ...f,
    dominios: dominios.map((d) => d.dominio),
    coordenacao: usuarios.map((u) => u.email),
    alunosAtivos: _count.usuarios,
  }));
}

type NovaFaculdade = {
  nome: string;
  sigla: string;
  corPrimaria: string;
  cidade: string;
  uf: string;
  dominios: string[];
  coordenacao: { nome: string; email: string };
};

/**
 * RF35: cadastra a faculdade, os domínios de e-mail e a conta da
 * coordenação. A senha provisória volta uma única vez, para ser entregue
 * à coordenação.
 */
export async function cadastrarFaculdade(
  ctx: Contexto,
  adminId: string,
  dados: NovaFaculdade,
) {
  const dominioDoEmail = dados.coordenacao.email.split('@')[1] ?? '';
  const aceito = dados.dominios.some(
    (d) => dominioDoEmail === d || dominioDoEmail.endsWith(`.${d}`),
  );
  if (!aceito) {
    throw new ErroApp(
      422,
      'dominio_nao_aceito',
      'O e-mail da coordenação precisa ser de um dos domínios.',
      {
        'coordenacao.email': 'Use um e-mail de um dos domínios informados',
      },
    );
  }
  const publico = dados.dominios.find(dominioPublico);
  if (publico) {
    throw new ErroApp(
      422,
      'dominio_publico',
      `"${publico}" é um domínio público (de qualquer pessoa), não de uma faculdade.`,
      { dominios: 'Use o domínio próprio da faculdade, como faculdade.edu.br' },
    );
  }
  // Domínio igual, "dentro" (aluno.x.edu.br quando x.edu.br já existe) ou "por
  // cima" (x.edu.br quando aluno.x.edu.br existe) roubaria os alunos de outra faculdade.
  const todos = await ctx.prisma.dominioEmail.findMany({ select: { dominio: true } });
  const conflitos = todos
    .map((d) => d.dominio)
    .filter((existente) =>
      dados.dominios.some(
        (novo) =>
          novo === existente ||
          novo.endsWith(`.${existente}`) ||
          existente.endsWith(`.${novo}`),
      ),
    );
  if (conflitos.length > 0) {
    throw new ErroApp(
      409,
      'dominio_em_uso',
      `Domínio já usado (ou sobreposto) por outra faculdade: ${conflitos.join(', ')}.`,
      { dominios: 'Domínio já usado por outra faculdade' },
    );
  }

  const senha = senhaProvisoria();
  const senhaHash = await gerarHash(senha);
  const faculdade = await ctx.prisma.$transaction(async (tx) => {
    const inst = await tx.instituicao.create({
      data: {
        nome: dados.nome,
        sigla: dados.sigla,
        corPrimaria: dados.corPrimaria,
        cidade: dados.cidade,
        uf: dados.uf,
        dominios: { create: dados.dominios.map((dominio) => ({ dominio })) },
      },
    });
    await tx.usuario.create({
      data: {
        instituicaoId: inst.id,
        papel: 'COORDENACAO',
        nome: dados.coordenacao.nome,
        apelido: 'Coordenação',
        email: dados.coordenacao.email,
        senhaHash,
        emailVerificadoEm: new Date(),
      },
    });
    await tx.auditoria.create({
      data: {
        instituicaoId: inst.id,
        atorTipo: 'ADMIN_PLATAFORMA',
        atorId: adminId,
        acao: 'faculdade_cadastrada',
        alvoTipo: 'instituicao',
        alvoId: inst.id,
        detalhes: { dominios: dados.dominios },
      },
    });
    return inst;
  });
  return {
    faculdade,
    coordenacao: { email: dados.coordenacao.email, senhaProvisoria: senha },
  };
}

/** RF36 / RN20: ativar ou desativar a faculdade. */
export async function mudarAtivacao(
  ctx: Contexto,
  adminId: string,
  id: string,
  ativa: boolean,
) {
  const existe = await ctx.prisma.instituicao.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe) throw naoEncontrado('Faculdade não encontrada.');
  const [faculdade] = await ctx.prisma.$transaction([
    ctx.prisma.instituicao.update({ where: { id }, data: { ativa } }),
    ctx.prisma.auditoria.create({
      data: {
        instituicaoId: id,
        atorTipo: 'ADMIN_PLATAFORMA',
        atorId: adminId,
        acao: ativa ? 'faculdade_ativada' : 'faculdade_desativada',
        alvoTipo: 'instituicao',
        alvoId: id,
      },
    }),
  ]);
  if (!ativa) ctx.notificar.desconectarFaculdade(id);
  return faculdade;
}

/** RF37 / RN17: métricas gerais, somente em totais. */
export async function metricas(ctx: Contexto) {
  const desde = new Date(Date.now() - 30 * 86_400_000);
  const [faculdades, faculdadesAtivas, alunos, conexoes, mensagens, denunciasAbertas] =
    await Promise.all([
      ctx.prisma.instituicao.count(),
      ctx.prisma.instituicao.count({ where: { ativa: true } }),
      ctx.prisma.usuario.count({ where: { papel: 'ALUNO', status: 'ATIVA' } }),
      ctx.prisma.match.count({ where: { desfeitoEm: null } }),
      ctx.prisma.mensagem.count({ where: { criadoEm: { gte: desde } } }),
      ctx.prisma.denuncia.count({ where: { status: 'ABERTA' } }),
    ]);
  return {
    faculdades,
    faculdadesAtivas,
    alunosAtivos: alunos,
    conexoesAtivas: conexoes,
    mensagensUltimos30Dias: mensagens,
    denunciasAbertas,
  };
}

/** A coordenação perdeu a senha: gera uma provisória nova e encerra as sessões dela. */
export async function novaSenhaDaCoordenacao(
  ctx: Contexto,
  adminId: string,
  instituicaoId: string,
  email: string,
) {
  const conta = await ctx.prisma.usuario.findFirst({
    where: { instituicaoId, email, papel: 'COORDENACAO' },
    select: { id: true },
  });
  if (!conta) throw naoEncontrado('Conta da coordenação não encontrada.');
  const senha = senhaProvisoria();
  const senhaHash = await gerarHash(senha);
  await ctx.prisma.$transaction([
    ctx.prisma.usuario.update({
      where: { id: conta.id },
      data: { senhaHash, senhaAlteradaEm: new Date() },
    }),
    ctx.prisma.sessao.updateMany({
      where: { usuarioId: conta.id, revogadaEm: null },
      data: { revogadaEm: new Date() },
    }),
    ctx.prisma.auditoria.create({
      data: {
        instituicaoId,
        atorTipo: 'ADMIN_PLATAFORMA',
        atorId: adminId,
        acao: 'senha_da_coordenacao_redefinida',
        alvoTipo: 'usuario',
        alvoId: conta.id,
      },
    }),
  ]);
  ctx.notificar.desconectar([conta.id]);
  return { email, senhaProvisoria: senha };
}

/** A equipe da plataforma troca a própria senha (confere a atual). */
export async function trocarSenhaDoAdmin(
  ctx: Contexto,
  adminId: string,
  senhaAtual: string,
  novaSenha: string,
) {
  const admin = await ctx.prisma.administrador.findUnique({ where: { id: adminId } });
  if (!admin) throw naoEncontrado();
  if (!(await conferir(senhaAtual, admin.senhaHash))) {
    throw new ErroApp(422, 'senha_atual_incorreta', 'A senha atual não confere.', {
      senhaAtual: 'Senha atual incorreta',
    });
  }
  const { count } = await ctx.prisma.administrador.updateMany({
    where: { id: adminId, senhaHash: admin.senhaHash },
    data: { senhaHash: await gerarHash(novaSenha) },
  });
  if (count === 0) {
    throw new ErroApp(
      409,
      'senha_alterada',
      'A senha acabou de ser trocada. Tente de novo.',
    );
  }
}
