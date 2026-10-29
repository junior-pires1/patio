import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

describe('GET /saude', () => {
  test('responde ok', async () => {
    const r = await request(t.app).get('/saude');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  test('a raiz identifica a API', async () => {
    const r = await request(t.app).get('/');
    expect(r.status).toBe(200);
    expect(r.body.nome).toBe('API do Pátio');
  });

  test('envia cabeçalhos de segurança', async () => {
    const r = await request(t.app).get('/saude');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  test('rota inexistente devolve 404 no formato padrão', async () => {
    for (const caminho of ['/nao-existe', '/auth/nao-existe']) {
      const r = await request(t.app).get(caminho);
      expect(r.status).toBe(404);
      expect(r.body.erro).toBe('rota_inexistente');
    }
  });

  test('JSON malformado devolve 400 no formato padrão', async () => {
    const r = await request(t.app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(r.status).toBe(400);
    expect(r.body.erro).toBe('json_invalido');
  });
});
