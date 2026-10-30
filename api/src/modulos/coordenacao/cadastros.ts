import { naFaculdade } from '../../banco/prisma';
import type { Contexto } from '../../contexto';
import { ErroApp, naoEncontrado } from '../../erros';
import { gerarHash, senhaProvisoria } from '../../seguranca/senha';
import type { Autenticado } from '../../seguranca/tokens';
import { faculdadeDoEmail } from '../auth/servico';
import { registrar } from './auditoria';

// Cadastros feitos pela coordenação: cursos, disciplinas e contas de alunos
// com senha provisória (para turmas que não recebem o código por e-mail).

const emUso = (oque: string) =>
  new ErroApp(409, 'em_uso', `${oque} já está em uso e não pode ser removido.`);

export function criarCurso(ctx: Contexto, eu: Autenticado, nome: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const curso = await tx.curso.create({
      data: { instituicaoId: eu.instituicaoId, nome },
      select: { id: true, nome: true },
    });
    await registrar(tx, eu, 'curso_cadastrado', { tipo: 'curso', id: curso.id }, { nome });
    return curso;
  });
}

export function removerCurso(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const curso = await tx.curso.findUnique({
      where: { id },
      select: { nome: true, _count: { select: { usuarios: true, disciplinas: true } } },
    });
    if (!curso) throw naoEncontrado();
    if (curso._count.usuarios > 0 || curso._count.disciplinas > 0) throw emUso('O curso');
    await tx.curso.delete({ where: { id } });
    await registrar(tx, eu, 'curso_removido', { tipo: 'curso', id }, { nome: curso.nome });
  });
}

export function criarDisciplina(
  ctx: Contexto,
  eu: Autenticado,
  dados: { nome: string; cursoId?: string | null },
) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (dados.cursoId && !(await tx.curso.findUnique({ where: { id: dados.cursoId } }))) {
      throw new ErroApp(422, 'curso_inexistente', 'Curso não encontrado.', {
        cursoId: 'Curso não encontrado',
      });
    }
    const disciplina = await tx.disciplina.create({
      data: {
        instituicaoId: eu.instituicaoId,
        nome: dados.nome,
        cursoId: dados.cursoId ?? null,
      },
      select: { id: true, nome: true, cursoId: true },
    });
    await registrar(
      tx,
      eu,
      'disciplina_cadastrada',
      { tipo: 'disciplina', id: disciplina.id },
      { nome: dados.nome },
    );
    return disciplina;
  });
}

export function removerDisciplina(ctx: Contexto, eu: Autenticado, id: string) {
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const disciplina = await tx.disciplina.findUnique({
      where: { id },
      select: { nome: true, _count: { select: { alunos: true, grupos: true } } },
    });
    if (!disciplina) throw naoEncontrado();
    if (disciplina._count.alunos > 0 || disciplina._count.grupos > 0) {
      throw emUso('A disciplina');
    }
    await tx.disciplina.delete({ where: { id } });
    await registrar(
      tx,
      eu,
      'disciplina_removida',
      { tipo: 'disciplina', id },
      { nome: disciplina.nome },
    );
  });
}

/** Cria a conta de um aluno já verificada, com senha provisória para entregar a ele. */
export async function criarAluno(
  ctx: Contexto,
  eu: Autenticado,
  dados: {
    nome: string;
    apelido: string;
    email: string;
    dataNascimento: Date;
    cursoId?: string | null;
  },
) {
  const faculdade = await faculdadeDoEmail(ctx, dados.email);
  if (faculdade?.id !== eu.instituicaoId) {
    throw new ErroApp(422, 'dominio_nao_aceito', 'Use um e-mail da sua faculdade.', {
      email: 'Use um e-mail de um dos domínios da sua faculdade',
    });
  }
  const senha = senhaProvisoria();
  const senhaHash = await gerarHash(senha);

  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    if (await tx.usuario.findUnique({ where: { email: dados.email } })) {
      throw new ErroApp(409, 'email_em_uso', 'Já existe uma conta com este e-mail.', {
        email: 'Já existe uma conta com este e-mail',
      });
    }
    if (dados.cursoId && !(await tx.curso.findUnique({ where: { id: dados.cursoId } }))) {
      throw new ErroApp(422, 'curso_inexistente', 'Curso não encontrado.', {
        cursoId: 'Curso não encontrado',
      });
    }
    const aluno = await tx.usuario.create({
      data: {
        instituicaoId: eu.instituicaoId,
        cursoId: dados.cursoId ?? null,
        nome: dados.nome,
        apelido: dados.apelido,
        email: dados.email,
        senhaHash,
        dataNascimento: dados.dataNascimento,
        emailVerificadoEm: new Date(),
      },
      select: { id: true, nome: true, email: true },
    });
    await registrar(tx, eu, 'aluno_cadastrado', { tipo: 'usuario', id: aluno.id });
    return { aluno, senhaProvisoria: senha };
  });
}

/** Gera uma nova senha provisória para o aluno e encerra as sessões dele. */
export async function novaSenhaDoAluno(ctx: Contexto, eu: Autenticado, id: string) {
  const senha = senhaProvisoria();
  const senhaHash = await gerarHash(senha);
  return naFaculdade(ctx.prisma, eu.instituicaoId, async (tx) => {
    const aluno = await tx.usuario.findFirst({
      where: { id, papel: 'ALUNO' },
      select: { id: true, email: true },
    });
    if (!aluno) throw naoEncontrado();
    await tx.usuario.update({ where: { id }, data: { senhaHash } });
    await tx.sessao.updateMany({
      where: { usuarioId: id, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    await registrar(tx, eu, 'senha_do_aluno_redefinida', { tipo: 'usuario', id });
    return { email: aluno.email, senhaProvisoria: senha };
  });
}
