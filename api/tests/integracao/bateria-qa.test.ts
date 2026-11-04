import request from 'supertest';
import { SENHA_DEMONSTRACAO } from '../../prisma/seed';
import { appDeTeste } from '../apoio/app';

// Defeitos encontrados na bateria de testes de 04/11/2026 (um teste por defeito).

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const novaImagem = async (s: Sessao) =>
  (
    await request(t.app)
      .post('/imagens')
      .set(auth(s))
      .set('Content-Type', 'application/octet-stream')
      .send(PNG)
  ).body.id as string;

describe('plataforma: domínios de faculdade', () => {
  let admin: string;
  beforeAll(async () => {
    const r = await request(t.app)
      .post('/plataforma/login')
      .send({ email: 'admin@patio.app', senha: SENHA_DEMONSTRACAO });
    admin = r.body.acessoToken;
  });
  const cadastrar = (dominio: string, email: string) =>
    request(t.app)
      .post('/plataforma/faculdades')
      .set({ Authorization: `Bearer ${admin}` })
      .send({
        nome: 'Faculdade QA',
        sigla: 'FQA',
        cidade: 'Guarulhos',
        uf: 'SP',
        dominios: [dominio],
        coordenacao: { nome: 'Coordenação QA', email },
      });

  test('recusa domínio público e sufixo genérico', async () => {
    expect((await cadastrar('gmail.com', 'coordqa@gmail.com')).body.erro).toBe(
      'dominio_publico',
    );
    expect((await cadastrar('edu.br', 'c@edu.br')).body.erro).toBe('dominio_publico');
  });

  test('recusa domínio dentro ou por cima do de outra faculdade', async () => {
    const dentro = await cadastrar('aluno.horizonte.edu.br', 'c@aluno.horizonte.edu.br');
    expect(dentro.status).toBe(409);
    const sufixo = `qa${Date.now().toString(36)}.edu.br`;
    expect((await cadastrar(`aluno.${sufixo}`, `c@aluno.${sufixo}`)).status).toBe(201);
    expect((await cadastrar(sufixo, `c@${sufixo}`)).status).toBe(409);
  });

  test('mensagens de validação em português', async () => {
    const r = await request(t.app)
      .post('/plataforma/faculdades')
      .set({ Authorization: `Bearer ${admin}` })
      .send({
        nome: 'Fa',
        sigla: 'F',
        cidade: 'X',
        uf: 'SP',
        dominios: ['fa.edu.br'],
        coordenacao: { nome: 'Co', email: 'c@fa.edu.br' },
      });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body.campos)).not.toMatch(/Too small|expected/);
    expect(r.body.campos.cidade).toMatch(/caracteres/);
  });
});

describe('regras de conteúdo', () => {
  test('evento no passado é recusado', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app).post('/posts').set(auth(a)).send({
      texto: 'Evento antigo',
      categoria: 'EVENTO',
      eventoInicio: '2020-01-01T10:00:00-03:00',
    });
    expect(r.status).toBe(400);
    expect(r.body.campos.eventoInicio).toBeDefined();
  });

  test('imagem de story não pode ser reaproveitada em post', async () => {
    const a = await t.cadastrarNovo();
    const imagemId = await novaImagem(a);
    await request(t.app).post('/stories').set(auth(a)).send({ imagemId });
    const r = await request(t.app).post('/posts').set(auth(a)).send({ imagemId });
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('imagem_em_uso');
  });

  test('"posso ajudar" e "preciso de ajuda" na mesma disciplina é contraditório', async () => {
    const a = await t.cadastrarNovo();
    const [d] = (await request(t.app).get('/disciplinas').set(auth(a))).body as {
      id: string;
    }[];
    const r = await request(t.app)
      .put('/eu/disciplinas')
      .set(auth(a))
      .send({
        itens: [
          { disciplinaId: d!.id, relacao: 'POSSO_AJUDAR' },
          { disciplinaId: d!.id, relacao: 'PRECISO_AJUDA' },
        ],
      });
    expect(r.status).toBe(400);
  });

  test('experiência começando daqui a décadas é recusada', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app)
      .post('/eu/experiencias')
      .set(auth(a))
      .send({ tipo: 'PROJETO', titulo: 'Futuro', inicio: '2099-01-01' });
    expect(r.status).toBe(400);
    expect(r.body.campos.inicio).toBeDefined();
  });

  test('link sem domínio de verdade é recusado', async () => {
    const a = await t.cadastrarNovo();
    for (const github of [
      'https://ftp://errado',
      'https://localhost',
      'https://semponto',
    ]) {
      const r = await request(t.app).patch('/eu').set(auth(a)).send({ links: { github } });
      expect(r.status).toBe(400);
    }
    const ok = await request(t.app)
      .patch('/eu')
      .set(auth(a))
      .send({ links: { github: 'https://github.com/qa' } });
    expect(ok.status).toBe(200);
  });

  test('curso e disciplina com o mesmo nome em outra caixa são duplicados', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const curso = await request(t.app)
      .post('/coordenacao/cursos')
      .set(auth(coord))
      .send({ nome: 'ciência da computação' });
    expect(curso.status).toBe(409);
    const disc = await request(t.app)
      .post('/coordenacao/disciplinas')
      .set(auth(coord))
      .send({ nome: 'CÁLCULO I' });
    expect(disc.status).toBe(409);
  });

  test('publicações de quem não aparece para você dão 404', async () => {
    const a = await t.cadastrarNovo();
    const fora = await t.cadastrarNovo('aluno.atlantica.edu.br');
    expect(
      (await request(t.app).get(`/usuarios/${a.usuario.id}/posts`).set(auth(fora))).status,
    ).toBe(404);
  });
});

describe('dados com tipo errado viram 400, nunca 500', () => {
  test('data impossível na experiência e no evento, texto nulo no post', async () => {
    const a = await t.cadastrarNovo();
    const corpos: [string, object][] = [
      ['/eu/experiencias', { tipo: 'PROJETO', titulo: 'Projeto', inicio: '2025-13-01' }],
      [
        '/eu/experiencias',
        { tipo: 'PROJETO', titulo: 'Projeto', inicio: '2024-01-01', fim: '2024-02-30' },
      ],
      ['/posts', { texto: 'Evento', categoria: 'EVENTO', eventoInicio: 'amanhã' }],
      ['/posts', { texto: null }],
      ['/posts', { texto: 42 }],
    ];
    for (const [rota, corpo] of corpos) {
      const r = await request(t.app).post(rota).set(auth(a)).send(corpo);
      expect([rota, r.status]).toEqual([rota, 400]);
    }
  });
});
