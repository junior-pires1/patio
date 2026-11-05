import request from 'supertest';
import { contaPodeConectar } from '../../src/tempo-real';
import { appDeTeste } from '../apoio/app';

// Defeitos achados na terceira bateria de testes (senhas e sessões).

const t = appDeTeste();
afterAll(() => t.fechar());

const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });
const login = (email: string, senha: string) =>
  request(t.app).post('/auth/login').send({ email, senha });

describe('tokens de acesso depois de trocar a senha', () => {
  test('trocar a senha derruba na hora os tokens dos outros aparelhos', async () => {
    const conta = await t.cadastrarNovo();
    const outro = (await login(conta.email, 'senhaForte123')).body;
    const troca = await request(t.app)
      .put('/auth/senha')
      .set(auth(conta))
      .send({ senhaAtual: 'senhaForte123', novaSenha: 'NovaSenha123' });
    expect(troca.status).toBe(200);
    const velho = await request(t.app).get('/eu').set(auth(outro));
    expect(velho.status).toBe(401);
    expect(velho.body.mensagem).toMatch(/senha foi trocada/);
    expect((await request(t.app).get('/eu').set(auth(conta))).status).toBe(401);
    // O token novo que a troca devolveu continua valendo.
    expect((await request(t.app).get('/eu').set(auth(troca.body))).status).toBe(200);
  });

  test('senha provisória da coordenação também derruba os tokens do aluno', async () => {
    const aluno = await t.cadastrarNovo();
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const r = await request(t.app)
      .post(`/coordenacao/alunos/${aluno.usuario.id}/senha`)
      .set(auth(coord));
    expect(r.status).toBe(200);
    expect((await request(t.app).get('/eu').set(auth(aluno))).status).toBe(401);
  });
});

describe('trocas de senha simultâneas', () => {
  test('duas trocas com a mesma senha atual: só uma vale', async () => {
    const conta = await t.cadastrarNovo();
    const r = await Promise.all(
      ['Primeira123', 'Segunda123'].map((novaSenha) =>
        request(t.app)
          .put('/auth/senha')
          .set(auth(conta))
          .send({ senhaAtual: 'senhaForte123', novaSenha }),
      ),
    );
    const aceitas = r.filter((x) => x.status === 200);
    expect(aceitas).toHaveLength(1);
    // A outra é recusada: ou a senha já mudou (409/422) ou, num computador mais
    // lento, o token dela já é anterior à troca (401). Nos três casos, não troca.
    expect(r.find((x) => x.status !== 200)?.body.erro).toMatch(
      /senha_alterada|senha_atual_incorreta|nao_autenticado/,
    );
    const logins = await Promise.all([
      login(conta.email, 'Primeira123'),
      login(conta.email, 'Segunda123'),
    ]);
    expect(logins.filter((x) => x.status === 200)).toHaveLength(1);
  });
});

describe('tamanho da senha', () => {
  test('senha que passa de 72 bytes (acentos) é recusada', async () => {
    const conta = await t.cadastrarNovo();
    const r = await request(t.app)
      .put('/auth/senha')
      .set(auth(conta))
      .send({ senhaAtual: 'senhaForte123', novaSenha: `${'á'.repeat(36)}Final123` });
    expect(r.status).toBe(400);
    expect(r.body.campos.novaSenha).toMatch(/longa demais/);
    // 72 letras sem acento continuam aceitas.
    const ok = await request(t.app)
      .put('/auth/senha')
      .set(auth(conta))
      .send({ senhaAtual: 'senhaForte123', novaSenha: `${'a'.repeat(70)}12` });
    expect(ok.status).toBe(200);
  });
});

describe('outro aparelho depois da troca de senha', () => {
  test('o aparelho antigo voltar não derruba a sessão de quem trocou a senha', async () => {
    const conta = await t.cadastrarNovo();
    const antigo = (await login(conta.email, 'senhaForte123')).body;
    const troca = (
      await request(t.app)
        .put('/auth/senha')
        .set(auth(conta))
        .send({ senhaAtual: 'senhaForte123', novaSenha: 'NovaSenha123' })
    ).body;
    // O aparelho antigo tenta renovar com o token que a troca encerrou: só recebe 401.
    const velho = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: antigo.refreshToken });
    expect(velho.status).toBe(401);
    // ...e quem trocou a senha continua logado.
    const atual = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: troca.refreshToken });
    expect(atual.status).toBe(200);
  });
});

describe('tempo real depois da troca de senha', () => {
  test('token emitido antes da troca não conecta; o novo conecta', async () => {
    const conta = await t.cadastrarNovo();
    const antes = { id: conta.usuario.id, instituicaoId: '', papel: 'ALUNO' as const };
    const emitidoAntes = Date.now() - 1000;
    const troca = await request(t.app)
      .put('/auth/senha')
      .set(auth(conta))
      .send({ senhaAtual: 'senhaForte123', novaSenha: 'NovaSenha123' });
    expect(troca.status).toBe(200);
    expect(await contaPodeConectar(t.prisma, { ...antes, emitidoEm: emitidoAntes })).toBe(
      false,
    );
    expect(await contaPodeConectar(t.prisma, { ...antes, emitidoEm: Date.now() })).toBe(
      true,
    );
  });
});
