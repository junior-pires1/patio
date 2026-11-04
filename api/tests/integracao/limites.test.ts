import request from 'supertest';
import { appDeTeste } from '../apoio/app';

// Poucas requisições por pessoa, muitas por IP: como numa rede de faculdade.
const t = appDeTeste({ geral: 4, credenciais: 1000, porIp: 1000 });
afterAll(() => t.fechar());

describe('limite de requisições', () => {
  test('conta por pessoa logada: um colega na mesma rede não esgota o limite do outro', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const eu = (s: { acessoToken: string }) =>
      request(t.app)
        .get('/eu')
        .set({ Authorization: `Bearer ${s.acessoToken}` });
    const deA = [];
    for (let i = 0; i < 5; i++) deA.push((await eu(a)).status);
    expect(deA.at(-1)).toBe(429);
    expect((await eu(b)).status).toBe(200);
  });
});
