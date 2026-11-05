import request from 'supertest';
import { appDeTeste } from '../apoio/app';

// Defeitos achados na segunda bateria de testes (rodadas 1 a 4).

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = Awaited<ReturnType<typeof t.cadastrarNovo>>;
const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });
const VAGA = {
  tipo: 'ESTAGIO',
  titulo: 'Vaga da bateria 2',
  descricao: 'Descrição com mais de dez letras.',
  modalidade: 'REMOTO',
};
const criarVaga = (s: Sessao, extra: object = {}) =>
  request(t.app)
    .post('/vagas')
    .set(auth(s))
    .send({ ...VAGA, ...extra });

describe('vagas', () => {
  test('prazo no passado ou a mais de 2 anos é recusado', async () => {
    const eu = await t.cadastrarNovo();
    const passado = await criarVaga(eu, { prazo: '2020-01-01' });
    expect(passado.status).toBe(400);
    expect(passado.body.campos.prazo).toMatch(/passado/);
    expect((await criarVaga(eu, { prazo: '2200-01-01' })).status).toBe(400);
    const hoje = new Date().toISOString().slice(0, 10);
    expect((await criarVaga(eu, { prazo: hoje })).status).toBe(201);
  });

  test('a busca filtra as vagas abertas e "%" não é curinga', async () => {
    const eu = await t.cadastrarNovo();
    const marca = `Marca${Date.now().toString(36)}`;
    await criarVaga(eu, { titulo: `Vaga ${marca}` });
    await criarVaga(eu, { titulo: 'Outra vaga qualquer' });
    const achou = (await request(t.app).get(`/vagas?q=${marca}`).set(auth(eu))).body;
    expect(achou.map((v: { titulo: string }) => v.titulo)).toEqual([`Vaga ${marca}`]);
    const curinga = (await request(t.app).get('/vagas?q=%25').set(auth(eu))).body;
    expect(curinga).toEqual([]);
  });

  test('encerrar de novo mantém a data em que foi encerrada', async () => {
    const eu = await t.cadastrarNovo();
    const { id } = (await criarVaga(eu)).body;
    const primeira = (await request(t.app).post(`/vagas/${id}/encerrar`).set(auth(eu)))
      .body;
    await new Promise((r) => setTimeout(r, 20));
    const segunda = (await request(t.app).post(`/vagas/${id}/encerrar`).set(auth(eu))).body;
    expect(segunda.encerradaEm).toBe(primeira.encerradaEm);
  });
});

describe('busca sem curingas', () => {
  test('"%" e "_" na busca de grupos e publicações não acham tudo', async () => {
    const eu = await t.cadastrarNovo();
    await request(t.app)
      .post('/posts')
      .set(auth(eu))
      .send({ texto: 'Post comum da bateria' });
    for (const q of ['%25%25', '__']) {
      const r = (await request(t.app).get(`/busca?q=${q}`).set(auth(eu))).body;
      expect(r.grupos).toEqual([]);
      expect(r.posts).toEqual([]);
    }
  });

  test('"%" na busca de alunos da coordenação não acha todo mundo', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const r = await request(t.app).get('/coordenacao/alunos?busca=%25').set(auth(coord));
    expect(r.status).toBe(200);
    const lista = Array.isArray(r.body) ? r.body : (r.body.alunos ?? r.body.itens);
    expect(lista).toEqual([]);
  });
});

describe('bloqueio e seguir', () => {
  test('bloquear desfaz o seguir nos dois sentidos', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app).put(`/usuarios/${b.usuario.id}/seguir`).set(auth(a));
    await request(t.app).put(`/usuarios/${a.usuario.id}/seguir`).set(auth(b));
    await request(t.app).post('/bloqueios').set(auth(b)).send({ usuarioId: a.usuario.id });
    const restantes = await t.prisma.seguidor.count({
      where: {
        OR: [
          { seguidorId: a.usuario.id, seguidoId: b.usuario.id },
          { seguidorId: b.usuario.id, seguidoId: a.usuario.id },
        ],
      },
    });
    expect(restantes).toBe(0);
  });
});

describe('super curtida', () => {
  test('cliques simultâneos não passam do limite de 3 por dia', async () => {
    const eu = await t.cadastrarNovo();
    const alvos = await Promise.all(Array.from({ length: 6 }, () => t.cadastrarNovo()));
    const r = await Promise.all(
      alvos.map((x) =>
        request(t.app)
          .post('/curtidas')
          .set(auth(eu))
          .send({ paraId: x.usuario.id, super: true }),
      ),
    );
    expect(r.filter((x) => x.status === 201)).toHaveLength(3);
    expect(r.filter((x) => x.status === 429)).toHaveLength(3);
  });
});

describe('filtros do descobrir', () => {
  test('semestre mínimo maior que o máximo é erro de validação', async () => {
    const eu = await t.cadastrarNovo();
    const r = await request(t.app)
      .get('/descobrir?semestreMin=8&semestreMax=2')
      .set(auth(eu));
    expect(r.status).toBe(400);
  });
});
