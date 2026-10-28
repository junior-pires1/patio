import request from 'supertest';
import { SENHA_DEMONSTRACAO } from '../../prisma/seed';
import { appDeTeste, dadosDeCadastro, emailNovo } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

async function pedirCodigo(email: string) {
  const r = await request(t.app).post('/auth/codigo').send({ email });
  return { r, codigo: t.caixa.codigo(email.trim().toLowerCase()) };
}

describe('POST /auth/codigo', () => {
  test('envia um código de 6 números para e-mail de faculdade parceira', async () => {
    const email = emailNovo();
    const { r, codigo } = await pedirCodigo(email);
    expect(r.status).toBe(202);
    expect(r.body.faculdade).toMatchObject({ sigla: 'FH', nome: 'Faculdade Horizonte' });
    expect(codigo).toMatch(/^\d{6}$/);
  });

  test('aceita e-mail em maiúsculas e com espaços', async () => {
    const email = emailNovo('atlantica.edu.br');
    const { r, codigo } = await pedirCodigo(`  ${email.toUpperCase()} `);
    expect(r.status).toBe(202);
    expect(r.body.faculdade.sigla).toBe('UA');
    expect(codigo).toBeDefined();
  });

  test('recusa e-mail que não é de faculdade parceira', async () => {
    for (const email of ['alguem@gmail.com', 'x@edu.br', 'x@falsohorizonte.edu.br']) {
      const { r } = await pedirCodigo(email);
      expect(r.status).toBe(422);
      expect(r.body.erro).toBe('dominio_nao_aceito');
    }
  });

  test('valida o formato do e-mail', async () => {
    const r = await request(t.app).post('/auth/codigo').send({ email: 'nao-e-email' });
    expect(r.status).toBe(400);
    expect(r.body.erro).toBe('dados_invalidos');
    expect(r.body.campos.email).toBeDefined();
  });

  test('avisa quando o e-mail já tem conta', async () => {
    const { r } = await pedirCodigo('ana.lima@aluno.horizonte.edu.br');
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('email_ja_cadastrado');
  });

  test('só deixa pedir outro código depois de 1 minuto', async () => {
    const email = emailNovo();
    expect((await pedirCodigo(email)).r.status).toBe(202);
    const { r } = await pedirCodigo(email);
    expect(r.status).toBe(429);
    expect(r.body.erro).toBe('aguarde_reenvio');
  });
});

describe('POST /auth/cadastro', () => {
  test('cria a conta e já devolve a sessão', async () => {
    const email = emailNovo();
    const { codigo } = await pedirCodigo(email);
    const r = await request(t.app)
      .post('/auth/cadastro')
      .send(dadosDeCadastro(email, codigo!));

    expect(r.status).toBe(201);
    expect(r.body.acessoToken).toEqual(expect.any(String));
    expect(r.body.refreshToken).toEqual(expect.any(String));
    expect(r.body.expiraEmSegundos).toBe(900);
    expect(r.body.usuario).toMatchObject({ email, papel: 'ALUNO', apelido: 'Teste' });
    expect(r.body.usuario.instituicao.sigla).toBe('FH');
    expect(r.body.usuario).not.toHaveProperty('senhaHash');
    expect(r.body.usuario).not.toHaveProperty('dataNascimento');

    const conta = await t.prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(conta.emailVerificadoEm).not.toBeNull();
    expect(conta.senhaHash).not.toContain('senhaForte123');
  });

  test('o código só pode ser usado uma vez', async () => {
    const { email } = await t.cadastrarNovo();
    const r = await request(t.app)
      .post('/auth/cadastro')
      .send(dadosDeCadastro(email, '000000'));
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('codigo_expirado');
  });

  test('código incorreto conta tentativas e bloqueia na quinta', async () => {
    const email = emailNovo();
    const { codigo } = await pedirCodigo(email);
    const errado = codigo === '000000' ? '111111' : '000000';

    for (let i = 1; i <= 5; i++) {
      const r = await request(t.app)
        .post('/auth/cadastro')
        .send(dadosDeCadastro(email, errado));
      expect(r.status).toBe(422);
      expect(r.body.erro).toBe('codigo_incorreto');
    }
    const certo = await request(t.app)
      .post('/auth/cadastro')
      .send(dadosDeCadastro(email, codigo!));
    expect(certo.status).toBe(429);
    expect(certo.body.erro).toBe('codigo_bloqueado');
  });

  test('código vencido não vale', async () => {
    const email = emailNovo();
    const { codigo } = await pedirCodigo(email);
    await t.prisma.codigoVerificacao.updateMany({
      where: { email },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    const r = await request(t.app)
      .post('/auth/cadastro')
      .send(dadosDeCadastro(email, codigo!));
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('codigo_expirado');
  });

  test('exige 18 anos e senha com letras e números', async () => {
    const email = emailNovo();
    const hoje = new Date();
    const menor = `${hoje.getUTCFullYear() - 17}-01-01`;
    const r = await request(t.app)
      .post('/auth/cadastro')
      .send({
        ...dadosDeCadastro(email, '123456'),
        dataNascimento: menor,
        senha: 'somenteletras',
      });
    expect(r.status).toBe(400);
    expect(r.body.campos.dataNascimento).toMatch(/18 anos/);
    expect(r.body.campos.senha).toMatch(/números/);
  });

  test('não aceita curso de outra faculdade', async () => {
    const cursoUa = await t.prisma.curso.findFirstOrThrow({
      where: { instituicao: { sigla: 'UA' } },
    });
    const email = emailNovo();
    const { codigo } = await pedirCodigo(email);
    const r = await request(t.app)
      .post('/auth/cadastro')
      .send({ ...dadosDeCadastro(email, codigo!), cursoId: cursoUa.id });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('curso_inexistente');
  });
});

describe('POST /auth/login', () => {
  test('entra com e-mail e senha corretos', async () => {
    const r = await request(t.app)
      .post('/auth/login')
      .send({ email: 'Ana.Lima@aluno.horizonte.edu.br', senha: SENHA_DEMONSTRACAO });
    expect(r.status).toBe(200);
    expect(r.body.usuario.apelido).toBe('Bia');
  });

  test('a coordenação também entra, com o papel certo', async () => {
    const r = await t.entrar('coordenacao@horizonte.edu.br');
    expect((r.usuario as unknown as { papel: string }).papel).toBe('COORDENACAO');
  });

  test('a mesma resposta para senha errada, e-mail inexistente ou domínio desconhecido', async () => {
    for (const [email, senha] of [
      ['ana.lima@aluno.horizonte.edu.br', 'senhaErrada1'],
      ['ninguem@horizonte.edu.br', SENHA_DEMONSTRACAO],
      ['ana@gmail.com', SENHA_DEMONSTRACAO],
    ]) {
      const r = await request(t.app).post('/auth/login').send({ email, senha });
      expect(r.status).toBe(401);
      expect(r.body.erro).toBe('credenciais_invalidas');
    }
  });

  test('conta suspensa não entra', async () => {
    const nova = await t.cadastrarNovo();
    await t.prisma.usuario.update({
      where: { id: nova.usuario.id },
      data: { status: 'SUSPENSA' },
    });
    const r = await request(t.app)
      .post('/auth/login')
      .send({ email: nova.email, senha: 'senhaForte123' });
    expect(r.status).toBe(403);
    expect(r.body.erro).toBe('conta_suspensa');
  });
});

describe('POST /auth/renovar e /auth/sair', () => {
  test('troca o token de renovação por um novo (rotação)', async () => {
    const sessao = await t.cadastrarNovo();
    const r = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: sessao.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).not.toBe(sessao.refreshToken);
    expect(r.body.usuario.id).toBe(sessao.usuario.id);
  });

  test('reuso de token antigo encerra todas as sessões da conta', async () => {
    const sessao = await t.cadastrarNovo();
    const nova = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: sessao.refreshToken });
    expect(nova.status).toBe(200);

    const reuso = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: sessao.refreshToken });
    expect(reuso.status).toBe(401);
    expect(reuso.body.erro).toBe('sessao_invalida');

    const depois = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: nova.body.refreshToken });
    expect(depois.status).toBe(401);
  });

  test('depois de sair, o token de renovação não vale mais', async () => {
    const sessao = await t.cadastrarNovo();
    const saida = await request(t.app)
      .post('/auth/sair')
      .send({ refreshToken: sessao.refreshToken });
    expect(saida.status).toBe(204);
    const r = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: sessao.refreshToken });
    expect(r.status).toBe(401);
  });

  test('token inventado ou mal formado não vale', async () => {
    for (const refreshToken of [
      'token-sem-formato-nenhum',
      '00000000-0000-0000-0000-000000000000.abcdefghij',
    ]) {
      const r = await request(t.app).post('/auth/renovar').send({ refreshToken });
      expect(r.status).toBe(401);
      const saida = await request(t.app).post('/auth/sair').send({ refreshToken });
      expect(saida.status).toBe(204);
    }
  });

  test('sessão vencida ou de conta suspensa não renova', async () => {
    const vencida = await t.cadastrarNovo();
    await t.prisma.sessao.updateMany({
      where: { usuarioId: vencida.usuario.id },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await request(t.app)
          .post('/auth/renovar')
          .send({ refreshToken: vencida.refreshToken })
      ).status,
    ).toBe(401);

    const suspensa = await t.cadastrarNovo();
    await t.prisma.usuario.update({
      where: { id: suspensa.usuario.id },
      data: { status: 'SUSPENSA' },
    });
    expect(
      (
        await request(t.app)
          .post('/auth/renovar')
          .send({ refreshToken: suspensa.refreshToken })
      ).status,
    ).toBe(401);
  });
});

describe('limite de tentativas', () => {
  test('bloqueia por um minuto após muitas tentativas com o mesmo e-mail', async () => {
    const limitado = appDeTeste({ geral: 1000, credenciais: 3 });
    try {
      const corpo = { email: 'bruno.souza@aluno.horizonte.edu.br', senha: 'errada123' };
      for (let i = 0; i < 3; i++) {
        expect((await request(limitado.app).post('/auth/login').send(corpo)).status).toBe(
          401,
        );
      }
      const r = await request(limitado.app).post('/auth/login').send(corpo);
      expect(r.status).toBe(429);
      expect(r.body.erro).toBe('muitas_requisicoes');
      expect(r.headers['ratelimit-policy']).toBeDefined();

      // Outro e-mail, do mesmo IP, ainda pode tentar
      const outro = await request(limitado.app)
        .post('/auth/login')
        .send({ ...corpo, email: 'carla.rocha@aluno.horizonte.edu.br' });
      expect(outro.status).toBe(401);
    } finally {
      await limitado.fechar();
    }
  });
});
