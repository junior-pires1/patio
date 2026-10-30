import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import { conferir, gerarHash, senhaProvisoria } from '../../seguranca/senha';
import { assinarPlataforma, DURACAO_PLATAFORMA_SEGUNDOS } from './acesso';

// As consultas daqui rodam como dono do banco (fora do RLS): são da
// plataforma, não de uma faculdade. RN17: só totais, nunca dados de alunos.

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
  const existentes = await ctx.prisma.dominioEmail.findMany({
    where: { dominio: { in: dados.dominios } },
    select: { dominio: true },
  });
  if (existentes.length > 0) {
    throw new ErroApp(
      409,
      'dominio_em_uso',
      `Domínio já usado por outra faculdade: ${existentes.map((d) => d.dominio).join(', ')}.`,
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
