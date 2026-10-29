import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

const SENHA_NOVA = 'outraSenha456';

/** O cadastro acabou de gerar um código: finge que foi há 2 minutos (reenvio liberado). */
const envelhecerCodigos = (email: string) =>
  t.prisma.codigoVerificacao.updateMany({
    where: { email },
    data: { criadoEm: new Date(Date.now() - 2 * 60_000) },
  });

describe('esqueci minha senha (RF39)', () => {
  test('pede código, redefine, entra com a nova e derruba as sessões antigas', async () => {
    const conta = await t.cadastrarNovo();
    await envelhecerCodigos(conta.email);
    const pedido = await request(t.app)
      .post('/auth/senha/codigo')
      .send({ email: conta.email });
    expect(pedido.status).toBe(202);
    expect(t.caixa.finalidade(conta.email)).toBe('senha');
    const codigo = t.caixa.codigo(conta.email)!;

    const r = await request(t.app)
      .post('/auth/senha/redefinir')
      .send({ email: conta.email, codigo, senha: SENHA_NOVA });
    expect(r.status).toBe(200);
    expect(r.body.acessoToken).toEqual(expect.any(String));

    const antiga = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: conta.refreshToken });
    expect(antiga.status).toBe(401);
    expect(
      (
        await request(t.app)
          .post('/auth/login')
          .send({ email: conta.email, senha: 'senhaForte123' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(t.app)
          .post('/auth/login')
          .send({ email: conta.email, senha: SENHA_NOVA })
      ).status,
    ).toBe(200);
  });

  test('mesma resposta para e-mail sem conta ou de domínio desconhecido, sem enviar nada', async () => {
    for (const email of ['ninguem@aluno.horizonte.edu.br', 'alguem@gmail.com']) {
      const r = await request(t.app).post('/auth/senha/codigo').send({ email });
      expect(r.status).toBe(202);
      expect(t.caixa.codigo(email)).toBeUndefined();
    }
  });

  test('código errado conta tentativa; senha fraca é recusada; código não serve duas vezes', async () => {
    const conta = await t.cadastrarNovo();
    await envelhecerCodigos(conta.email);
    await request(t.app).post('/auth/senha/codigo').send({ email: conta.email });
    const codigo = t.caixa.codigo(conta.email)!;
    const errado = codigo === '000000' ? '111111' : '000000';

    const r1 = await request(t.app)
      .post('/auth/senha/redefinir')
      .send({ email: conta.email, codigo: errado, senha: SENHA_NOVA });
    expect(r1.body.erro).toBe('codigo_incorreto');
    const r2 = await request(t.app)
      .post('/auth/senha/redefinir')
      .send({ email: conta.email, codigo, senha: 'fraca' });
    expect(r2.status).toBe(400);
    expect(
      (
        await request(t.app)
          .post('/auth/senha/redefinir')
          .send({ email: conta.email, codigo, senha: SENHA_NOVA })
      ).status,
    ).toBe(200);
    const r3 = await request(t.app)
      .post('/auth/senha/redefinir')
      .send({ email: conta.email, codigo, senha: 'maisUma789' });
    expect(r3.body.erro).toBe('codigo_expirado');
  });

  test('conta suspensa não recebe código', async () => {
    const conta = await t.cadastrarNovo();
    await t.prisma.usuario.update({
      where: { id: conta.usuario.id },
      data: { status: 'SUSPENSA' },
    });
    await request(t.app).post('/auth/senha/codigo').send({ email: conta.email });
    expect(t.caixa.finalidade(conta.email)).toBe('cadastro');
  });
});

describe('trocar a senha logado', () => {
  test('confere a senha atual e devolve uma sessão nova', async () => {
    const conta = await t.cadastrarNovo();
    const auth = { Authorization: `Bearer ${conta.acessoToken}` };
    const errada = await request(t.app)
      .put('/auth/senha')
      .set(auth)
      .send({ senhaAtual: 'naoEhEssa1', novaSenha: SENHA_NOVA });
    expect(errada.status).toBe(422);
    expect(errada.body.campos.senhaAtual).toBeDefined();
    const igual = await request(t.app)
      .put('/auth/senha')
      .set(auth)
      .send({ senhaAtual: 'senhaForte123', novaSenha: 'senhaForte123' });
    expect(igual.body.campos.novaSenha).toBeDefined();

    const r = await request(t.app)
      .put('/auth/senha')
      .set(auth)
      .send({ senhaAtual: 'senhaForte123', novaSenha: SENHA_NOVA });
    expect(r.status).toBe(200);
    // A sessão nova vale; a antiga foi encerrada na troca
    const nova = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: r.body.refreshToken });
    expect(nova.status).toBe(200);
    const antiga = await t.prisma.sessao.findFirstOrThrow({
      where: { refreshTokenHash: { not: '' }, usuarioId: conta.usuario.id },
      orderBy: { criadoEm: 'asc' },
    });
    expect(antiga.revogadaEm).not.toBeNull();
  });

  test('a coordenação troca a senha provisória', async () => {
    const coord = await t.entrar('coordenacao@ipe.edu.br');
    const r = await request(t.app)
      .put('/auth/senha')
      .set({ Authorization: `Bearer ${coord.acessoToken}` })
      .send({ senhaAtual: 'Patio2026', novaSenha: 'NovaCoord2026' });
    expect(r.status).toBe(200);
    expect(
      (
        await request(t.app)
          .post('/auth/login')
          .send({ email: 'coordenacao@ipe.edu.br', senha: 'NovaCoord2026' })
      ).status,
    ).toBe(200);
  });
});
