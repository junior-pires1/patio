import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });
const criar = (s: Sessao, corpo: object) =>
  request(t.app).post('/grupos').set(auth(s)).send(corpo);
const entrar = (s: Sessao, id: string) =>
  request(t.app).post(`/grupos/${id}/entrar`).set(auth(s));

describe('grupos de estudo', () => {
  test('cria grupo de uma disciplina; quem cria já é membro', async () => {
    const a = await t.cadastrarNovo();
    const calculo = await t.prisma.disciplina.findFirstOrThrow({
      where: { instituicao: { sigla: 'FH' }, nome: 'Cálculo I' },
    });
    const r = await criar(a, {
      nome: 'Cálculo de terça',
      disciplinaId: calculo.id,
      encontro: 'Terças 19h',
      local: 'Biblioteca',
      vagas: 5,
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      nome: 'Cálculo de terça',
      membros: 1,
      vagasLivres: 4,
      souMembro: true,
      disciplina: { nome: 'Cálculo I' },
    });

    const lista = await request(t.app)
      .get(`/grupos?disciplinaId=${calculo.id}`)
      .set(auth(a));
    expect(lista.body.map((g: { id: string }) => g.id)).toContain(r.body.id);
    const detalhe = await request(t.app).get(`/grupos/${r.body.id}`).set(auth(a));
    expect(detalhe.body.listaDeMembros).toEqual([
      expect.objectContaining({
        papel: 'CRIADOR',
        usuario: expect.objectContaining({ id: a.usuario.id }),
      }),
    ]);
  });

  test('respeita as vagas (RN12)', async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map(() => t.cadastrarNovo()));
    const g = await criar(a!, { nome: 'Grupo pequeno', vagas: 3 });
    expect((await entrar(b!, g.body.id)).body.vagasLivres).toBe(1);
    expect((await entrar(c!, g.body.id)).body.vagasLivres).toBe(0);
    const cheio = await entrar(d!, g.body.id);
    expect(cheio.status).toBe(422);
    expect(cheio.body.erro).toBe('grupo_cheio');
    // Entrar de novo não duplica
    expect((await entrar(b!, g.body.id)).status).toBe(200);
  });

  test('chat só para membros, com aviso em tempo real e não lidas', async () => {
    const [a, b, fora] = await Promise.all([1, 2, 3].map(() => t.cadastrarNovo()));
    const g = await criar(a!, { nome: 'Grupo do chat' });
    await entrar(b!, g.body.id);

    const enviar = (s: Sessao, texto: string) =>
      request(t.app).post(`/grupos/${g.body.id}/mensagens`).set(auth(s)).send({ texto });
    expect((await enviar(a!, 'Bem-vindos!')).status).toBe(201);
    const evento = t.eventos.find(
      (e) =>
        e.evento === 'grupo:mensagem' &&
        (e.dados as { grupoId: string }).grupoId === g.body.id,
    );
    expect(evento?.usuarioIds.sort()).toEqual([a!.usuario.id, b!.usuario.id].sort());

    const meus = await request(t.app).get('/grupos?meus=true').set(auth(b!));
    expect(meus.body.find((x: { id: string }) => x.id === g.body.id).naoLidas).toBe(1);
    const chat = await request(t.app).get(`/grupos/${g.body.id}/mensagens`).set(auth(b!));
    expect(chat.body.mensagens.map((m: { texto: string }) => m.texto)).toEqual([
      'Bem-vindos!',
    ]);
    expect(
      (await request(t.app).get('/grupos?meus=true').set(auth(b!))).body.find(
        (x: { id: string }) => x.id === g.body.id,
      ).naoLidas,
    ).toBe(0);

    expect((await enviar(fora!, 'Posso?')).status).toBe(403);
    expect(
      (await request(t.app).get(`/grupos/${g.body.id}/mensagens`).set(auth(fora!))).body
        .erro,
    ).toBe('nao_e_membro');
  });

  test('quando o criador sai, o membro mais antigo assume; sem membros, o grupo some', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const g = await criar(a!, { nome: 'Grupo que muda de dono' });
    await entrar(b!, g.body.id);
    expect(
      (await request(t.app).post(`/grupos/${g.body.id}/sair`).set(auth(a!))).body,
    ).toEqual({ grupoApagado: false });
    const detalhe = await request(t.app).get(`/grupos/${g.body.id}`).set(auth(b!));
    expect(detalhe.body.criador.id).toBe(b!.usuario.id);
    expect(detalhe.body.listaDeMembros[0].papel).toBe('CRIADOR');

    expect(
      (await request(t.app).post(`/grupos/${g.body.id}/sair`).set(auth(b!))).body,
    ).toEqual({ grupoApagado: true });
    expect((await request(t.app).get(`/grupos/${g.body.id}`).set(auth(b!))).status).toBe(
      404,
    );
  });

  test('valida os dados e isola por faculdade', async () => {
    const a = await t.cadastrarNovo();
    const r = await criar(a, { nome: 'x', vagas: 50 });
    expect(Object.keys(r.body.campos).sort()).toEqual(['nome', 'vagas']);

    const g = await criar(a, { nome: 'Grupo da Horizonte' });
    const outra = await t.cadastrarNovo('aluno.atlantica.edu.br');
    expect((await entrar(outra, g.body.id)).status).toBe(404);
    const bdUa = await t.prisma.disciplina.findFirstOrThrow({
      where: { instituicao: { sigla: 'UA' } },
    });
    expect((await criar(a, { nome: 'Grupo errado', disciplinaId: bdUa.id })).status).toBe(
      422,
    );

    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    expect(
      (
        await request(t.app)
          .get('/grupos')
          .set(auth(coord as Sessao))
      ).status,
    ).toBe(403);
  });
});
