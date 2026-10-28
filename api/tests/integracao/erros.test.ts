import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { criarPrisma } from '../../src/banco/prisma';
import { converterErro, ErroApp, tratarErros } from '../../src/erros';
import { Prisma } from '../../src/generated/prisma/client';
import { urlTeste } from '../apoio/banco';

const prisma = criarPrisma(urlTeste());
afterAll(() => prisma.$disconnect());

/** Executa a operação no banco e devolve o erro convertido. */
async function erroDe(operacao: () => Promise<unknown>) {
  try {
    await operacao();
  } catch (e) {
    return converterErro(e);
  }
  throw new Error('A operação deveria ter falhado');
}

describe('converterErro', () => {
  test('mantém um ErroApp como está', () => {
    const erro = new ErroApp(418, 'bule', 'Sou um bule.');
    expect(converterErro(erro)).toBe(erro);
  });

  test('ZodError vira 400 com a mensagem de cada campo', () => {
    const r = z
      .object({ idade: z.number().min(18, 'Muito novo') })
      .safeParse({ idade: 10 });
    const erro = converterErro(r.error);
    expect(erro).toMatchObject({
      status: 400,
      codigo: 'dados_invalidos',
      campos: { idade: 'Muito novo' },
    });
  });

  test('registro não encontrado pelo Prisma vira 404', () => {
    const e = new Prisma.PrismaClientKnownRequestError('não achou', {
      code: 'P2025',
      clientVersion: 'x',
    });
    expect(converterErro(e).status).toBe(404);
  });

  test('erro desconhecido vira 500 sem detalhes internos', () => {
    const erro = converterErro(new Error('senha do banco: 123'));
    expect(erro).toMatchObject({ status: 500, codigo: 'erro_interno' });
    expect(erro.message).not.toContain('123');
  });

  describe('erros reais do banco', () => {
    let faculdade: string;
    let outra: string;
    beforeAll(async () => {
      faculdade = (await prisma.instituicao.findFirstOrThrow({ where: { sigla: 'FH' } }))
        .id;
      outra = (await prisma.instituicao.findFirstOrThrow({ where: { sigla: 'UA' } })).id;
    });
    const aluno = (email: string, dataNascimento = new Date('2000-01-01')) => ({
      instituicaoId: faculdade,
      nome: 'Erro',
      apelido: 'Erro',
      email,
      senhaHash: 'x',
      dataNascimento,
    });

    test('gatilhos com nome viram mensagens amigáveis (422)', async () => {
      expect(
        await erroDe(() => prisma.usuario.create({ data: aluno('x@gmail.com') })),
      ).toMatchObject({
        status: 422,
        codigo: 'dominio_nao_aceito',
      });
      expect(
        await erroDe(() =>
          prisma.usuario.create({ data: aluno('menor@horizonte.edu.br', new Date()) }),
        ),
      ).toMatchObject({ status: 422, codigo: 'idade_minima' });
    });

    test('valor duplicado vira 409', async () => {
      const erro = await erroDe(() =>
        prisma.usuario.create({ data: aluno('ana.lima@aluno.horizonte.edu.br') }),
      );
      expect(erro).toMatchObject({ status: 409, codigo: 'duplicado' });
    });

    test('CHECK sem mensagem própria vira 422 genérico', async () => {
      const erro = await erroDe(() =>
        prisma.usuario.create({
          data: { ...aluno('semestre@horizonte.edu.br'), semestre: 40 },
        }),
      );
      expect(erro).toMatchObject({ status: 422, codigo: 'regra_violada' });
    });

    test('referência a registro de outra faculdade vira 422', async () => {
      const cursoUa = await prisma.curso.findFirstOrThrow({
        where: { instituicaoId: outra },
      });
      const erro = await erroDe(() =>
        prisma.usuario.create({
          data: { ...aluno('fk@horizonte.edu.br'), cursoId: cursoUa.id },
        }),
      );
      expect(erro).toMatchObject({ status: 422, codigo: 'referencia_invalida' });
    });
  });
});

describe('tratarErros', () => {
  test('responde no formato padrão e registra só os erros 500', async () => {
    const app = express();
    app.get('/esperado', () => {
      throw new ErroApp(409, 'conflito', 'Já existe.', { nome: 'Repetido' });
    });
    app.get('/inesperado', () => {
      throw new Error('falha interna');
    });
    app.use(tratarErros);

    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const esperado = await request(app).get('/esperado');
    expect(esperado.status).toBe(409);
    expect(esperado.body).toEqual({
      erro: 'conflito',
      mensagem: 'Já existe.',
      campos: { nome: 'Repetido' },
    });
    expect(registro).not.toHaveBeenCalled();

    const inesperado = await request(app).get('/inesperado');
    expect(inesperado.status).toBe(500);
    expect(inesperado.body).toEqual({
      erro: 'erro_interno',
      mensagem: 'Algo deu errado. Tente novamente em instantes.',
    });
    expect(registro).toHaveBeenCalledOnce();
    registro.mockRestore();
  });
});
