import request from 'supertest';
import { criarApp } from '../../src/app';

const app = criarApp({ origensPermitidas: ['http://localhost:3000'] });

describe('GET /saude', () => {
  test('responde ok', async () => {
    const r = await request(app).get('/saude');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  test('envia cabeçalhos de segurança', async () => {
    const r = await request(app).get('/saude');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  test('rota inexistente devolve 404 no formato padrão', async () => {
    const r = await request(app).get('/nao-existe');
    expect(r.status).toBe(404);
    expect(r.body.erro).toBe('rota_inexistente');
  });
});
