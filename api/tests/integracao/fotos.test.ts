import request from 'supertest';
import { tipoDaImagem } from '../../src/modulos/fotos/servico';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

// Menor PNG válido (1x1 pixel)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('foto de perfil (RF06)', () => {
  test('envia, aparece no perfil e é servida pelo endereço', async () => {
    const a = await t.cadastrarNovo();
    const auth = { Authorization: `Bearer ${a.acessoToken}` };
    const r = await request(t.app)
      .put('/eu/foto')
      .set(auth)
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(r.status).toBe(200);
    expect(r.body.fotoUrl).toMatch(/^\/fotos\/[0-9a-f-]{36}$/);

    expect((await request(t.app).get('/eu').set(auth)).body.fotoUrl).toBe(r.body.fotoUrl);
    const imagem = await request(t.app).get(r.body.fotoUrl);
    expect(imagem.status).toBe(200);
    expect(imagem.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(imagem.body as Buffer, PNG)).toBe(0);

    // Trocar a foto muda o endereço; a antiga deixa de existir
    const nova = await request(t.app)
      .put('/eu/foto')
      .set(auth)
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(nova.body.fotoUrl).not.toBe(r.body.fotoUrl);
    expect((await request(t.app).get(r.body.fotoUrl)).status).toBe(404);

    expect((await request(t.app).delete('/eu/foto').set(auth)).status).toBe(204);
    expect((await request(t.app).get('/eu').set(auth)).body.fotoUrl).toBeNull();
    expect((await request(t.app).get(nova.body.fotoUrl)).status).toBe(404);
  });

  test('recusa o que não é imagem, imagem grande demais e envio sem login', async () => {
    const a = await t.cadastrarNovo();
    const auth = { Authorization: `Bearer ${a.acessoToken}` };
    const texto = await request(t.app)
      .put('/eu/foto')
      .set(auth)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('não sou imagem'));
    expect(texto.status).toBe(415);
    const grande = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 2048)]);
    const r = await request(t.app)
      .put('/eu/foto')
      .set(auth)
      .set('Content-Type', 'image/png')
      .send(grande);
    expect(r.status).toBe(413);
    expect(
      (await request(t.app).put('/eu/foto').set('Content-Type', 'image/png').send(PNG))
        .status,
    ).toBe(401);
  });

  test('conta suspensa deixa de mostrar a foto', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app)
      .put('/eu/foto')
      .set({ Authorization: `Bearer ${a.acessoToken}` })
      .set('Content-Type', 'image/png')
      .send(PNG);
    await t.prisma.usuario.update({
      where: { id: a.usuario.id },
      data: { status: 'SUSPENSA' },
    });
    expect((await request(t.app).get(r.body.fotoUrl)).status).toBe(404);
  });

  test('reconhece JPG, PNG e WebP pela assinatura', () => {
    expect(tipoDaImagem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(tipoDaImagem(new Uint8Array(PNG))).toBe('image/png');
    expect(tipoDaImagem(new Uint8Array(Buffer.from('RIFF0000WEBPVP8 ')))).toBe(
      'image/webp',
    );
    expect(tipoDaImagem(new Uint8Array(Buffer.from('GIF89a')))).toBeNull();
  });
});
