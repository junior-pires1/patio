import request from 'supertest';
import { mensagemDoEvento, notificadorPush } from '../../src/modulos/push/servico';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

const tokenNovo = () => `ExponentPushToken[${Math.random().toString(36).slice(2)}]`;
const esperar = () => new Promise((ok) => setTimeout(ok, 300));

describe('notificações com o app fechado (RF27)', () => {
  test('registra o aparelho; o mesmo token passa para a última conta que entrou', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const token = tokenNovo();
    expect(
      (
        await request(t.app)
          .put('/eu/push')
          .set({ Authorization: `Bearer ${a.acessoToken}` })
          .send({ token })
      ).status,
    ).toBe(204);
    await request(t.app)
      .put('/eu/push')
      .set({ Authorization: `Bearer ${b.acessoToken}` })
      .send({ token });
    const donos = await t.prisma.dispositivoPush.findMany({ where: { token } });
    expect(donos.map((d) => d.usuarioId)).toEqual([b.usuario.id]);

    const invalido = await request(t.app)
      .put('/eu/push')
      .set({ Authorization: `Bearer ${b.acessoToken}` })
      .send({ token: 'qualquer' });
    expect(invalido.status).toBe(400);
    expect(
      (
        await request(t.app)
          .delete('/eu/push')
          .set({ Authorization: `Bearer ${b.acessoToken}` })
          .send({ token })
      ).status,
    ).toBe(204);
    expect(await t.prisma.dispositivoPush.count({ where: { token } })).toBe(0);
  });

  test('manda o push pela Expo só para quem deve receber e apaga token inválido', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const [tokenA, tokenB] = [tokenNovo(), tokenNovo()];
    await request(t.app)
      .put('/eu/push')
      .set({ Authorization: `Bearer ${a.acessoToken}` })
      .send({ token: tokenA });
    await request(t.app)
      .put('/eu/push')
      .set({ Authorization: `Bearer ${b.acessoToken}` })
      .send({ token: tokenB });

    const enviados: { to: string; title: string; body: string }[][] = [];
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const lote = JSON.parse(init?.body as string);
      enviados.push(lote);
      return new Response(
        JSON.stringify({
          data: lote.map(() => ({
            status: 'error',
            details: { error: 'DeviceNotRegistered' },
          })),
        }),
      );
    });
    const push = notificadorPush(t.prisma, fetch as unknown as typeof globalThis.fetch);

    // Mensagem de A para B: só B recebe
    push.enviar([a.usuario.id, b.usuario.id], 'mensagem:nova', {
      matchId: 'm1',
      mensagem: { autorId: a.usuario.id, texto: 'Oi!' },
    });
    await esperar();
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toEqual([
      expect.objectContaining({ to: tokenB, title: 'Nova mensagem', body: 'Oi!' }),
    ]);
    // A Expo disse que o aparelho não existe mais: token apagado
    expect(await t.prisma.dispositivoPush.count({ where: { token: tokenB } })).toBe(0);

    // Sem aparelhos, nada é enviado
    push.enviar([b.usuario.id], 'curtida:nova', {});
    await esperar();
    expect(enviados).toHaveLength(1);
  });

  test('cada evento tem título e destino próprios', () => {
    expect(mensagemDoEvento(['x'], 'curtida:nova', {})?.titulo).toContain('curtiu');
    expect(mensagemDoEvento(['x', 'y'], 'match:novo', { matchId: 'm' })).toMatchObject({
      destino: ['x', 'y'],
      dados: { matchId: 'm' },
    });
    expect(
      mensagemDoEvento(['x', 'y'], 'grupo:mensagem', {
        grupoId: 'g',
        mensagem: { autor: { id: 'x', apelido: 'Bia' }, texto: 'oi' },
      }),
    ).toMatchObject({ titulo: 'Bia no grupo', destino: ['y'], dados: { grupoId: 'g' } });
    expect(mensagemDoEvento(['x'], 'match:desfeito', {})).toBeNull();
  });
});
