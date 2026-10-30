import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });
let seq = 0;
const unico = () => `${Date.now().toString(36)}${seq++}`;

let coord: Sessao;
let coordUa: Sessao;
beforeAll(async () => {
  [coord, coordUa] = await Promise.all([
    t.entrar('coordenacao@horizonte.edu.br'),
    t.entrar('coordenacao@atlantica.edu.br'),
  ]);
});

describe('coordenação cadastra alunos', () => {
  test('cria a conta com senha provisória, o aluno entra e troca a senha', async () => {
    const email = `novo.${unico()}@aluno.horizonte.edu.br`;
    const r = await request(t.app).post('/coordenacao/alunos').set(auth(coord)).send({
      nome: 'Aluno do Grupo',
      apelido: 'Grupo',
      email,
      dataNascimento: '2003-05-10',
    });
    expect(r.status).toBe(201);
    expect(r.body.senhaProvisoria).toMatch(/^[a-z]{4}\d{4}$/);

    const login = await request(t.app)
      .post('/auth/login')
      .send({ email, senha: r.body.senhaProvisoria });
    expect(login.status).toBe(200);
    expect(login.body.usuario.papel).toBe('ALUNO');

    const troca = await request(t.app)
      .put('/auth/senha')
      .set(auth(login.body))
      .send({ senhaAtual: r.body.senhaProvisoria, novaSenha: 'minhaSenha123' });
    expect(troca.status).toBe(200);
  });

  test('recusa e-mail de outra faculdade, repetido ou de quem não é coordenação', async () => {
    const outra = await request(t.app).post('/coordenacao/alunos').set(auth(coord)).send({
      nome: 'Fulano de Tal',
      apelido: 'Fulano',
      email: 'x@atlantica.edu.br',
      dataNascimento: '2003-05-10',
    });
    expect(outra.status).toBe(422);
    expect(outra.body.campos.email).toBeDefined();

    const repetido = await request(t.app)
      .post('/coordenacao/alunos')
      .set(auth(coord))
      .send({
        nome: 'Ana de Novo',
        apelido: 'Ana',
        email: 'ana.lima@aluno.horizonte.edu.br',
        dataNascimento: '2003-05-10',
      });
    expect(repetido.status).toBe(409);

    const aluno = await t.cadastrarNovo();
    const proibido = await request(t.app)
      .post('/coordenacao/alunos')
      .set(auth(aluno))
      .send({
        nome: 'Outro Aluno',
        apelido: 'Outro',
        email: `o.${unico()}@horizonte.edu.br`,
        dataNascimento: '2003-05-10',
      });
    expect(proibido.status).toBe(403);
  });

  test('nova senha provisória derruba as sessões do aluno; só vale na própria faculdade', async () => {
    const aluno = await t.cadastrarNovo();
    const deOutra = await request(t.app)
      .post(`/coordenacao/alunos/${aluno.usuario.id}/senha`)
      .set(auth(coordUa));
    expect(deOutra.status).toBe(404);

    const r = await request(t.app)
      .post(`/coordenacao/alunos/${aluno.usuario.id}/senha`)
      .set(auth(coord));
    expect(r.status).toBe(200);
    const antiga = await request(t.app)
      .post('/auth/renovar')
      .send({ refreshToken: aluno.refreshToken });
    expect(antiga.status).toBe(401);
    const login = await request(t.app)
      .post('/auth/login')
      .send({ email: aluno.email, senha: r.body.senhaProvisoria });
    expect(login.status).toBe(200);
  });
});

describe('coordenação cadastra cursos e disciplinas', () => {
  test('cria, lista, recusa nome repetido e remove o que não está em uso', async () => {
    const nomeCurso = `Curso ${unico()}`;
    const curso = await request(t.app)
      .post('/coordenacao/cursos')
      .set(auth(coord))
      .send({ nome: nomeCurso });
    expect(curso.status).toBe(201);
    expect(
      (
        await request(t.app)
          .post('/coordenacao/cursos')
          .set(auth(coord))
          .send({ nome: nomeCurso })
      ).status,
    ).toBe(409);

    const disc = await request(t.app)
      .post('/coordenacao/disciplinas')
      .set(auth(coord))
      .send({ nome: `Disciplina ${unico()}`, cursoId: curso.body.id });
    expect(disc.status).toBe(201);

    const lista = await request(t.app)
      .get(`/disciplinas?cursoId=${curso.body.id}`)
      .set(auth(coord));
    expect(lista.body.map((d: { id: string }) => d.id)).toContain(disc.body.id);
    // A outra faculdade não enxerga
    const daOutra = await request(t.app).get('/cursos').set(auth(coordUa));
    expect(daOutra.body.map((c: { id: string }) => c.id)).not.toContain(curso.body.id);

    // Curso com disciplina não sai; primeiro a disciplina
    expect(
      (await request(t.app).delete(`/coordenacao/cursos/${curso.body.id}`).set(auth(coord)))
        .status,
    ).toBe(409);
    expect(
      (
        await request(t.app)
          .delete(`/coordenacao/disciplinas/${disc.body.id}`)
          .set(auth(coord))
      ).status,
    ).toBe(204);
    expect(
      (await request(t.app).delete(`/coordenacao/cursos/${curso.body.id}`).set(auth(coord)))
        .status,
    ).toBe(204);
  });

  test('disciplina usada por aluno não pode ser removida', async () => {
    const lista = await request(t.app).get('/disciplinas').set(auth(coord));
    const banco = lista.body.find((d: { nome: string }) => d.nome === 'Banco de Dados');
    const r = await request(t.app)
      .delete(`/coordenacao/disciplinas/${banco.id}`)
      .set(auth(coord));
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('em_uso');
  });
});
