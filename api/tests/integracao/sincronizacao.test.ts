import request from 'supertest';
import { appDeTeste } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = { acessoToken: string; usuario: { id: string; instituicaoId?: string } };
const auth = (s: Sessao) => ({ Authorization: `Bearer ${s.acessoToken}` });
const eventosDe = (evento: string) =>
  t.eventosDaFaculdade.filter((e) => e.evento === evento);
const limpar = () => {
  t.eventosDaFaculdade.length = 0;
};

// A faculdade do evento vem do token de quem fez a ação.
async function faculdadeDe(s: Sessao): Promise<string> {
  const r = await request(t.app).get('/eu').set(auth(s));
  return r.body.instituicaoId as string;
}

describe('eventos de sincronização da faculdade', () => {
  beforeEach(limpar);

  test('publicar avisa a faculdade do autor, só com o id', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'Publicação fictícia' });
    expect(r.status).toBe(201);
    expect(eventosDe('post:novo')).toEqual([
      {
        instituicaoId: await faculdadeDe(a),
        evento: 'post:novo',
        dados: { postId: r.body.id },
      },
    ]);
  });

  test('publicação inválida não gera evento', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app).post('/posts').set(auth(a)).send({ texto: '' });
    expect(r.status).toBe(400);
    expect(eventosDe('post:novo')).toEqual([]);
  });

  test('remover avisa a faculdade, pelo autor e pela coordenação', async () => {
    const a = await t.cadastrarNovo();
    const coordenacao = await t.entrar('coordenacao@horizonte.edu.br');
    const criar = async () =>
      (await request(t.app).post('/posts').set(auth(a)).send({ texto: 'Fictícia' })).body
        .id as string;

    const doAutor = await criar();
    await request(t.app).delete(`/posts/${doAutor}`).set(auth(a));
    const daCoordenacao = await criar();
    await request(t.app).delete(`/posts/${daCoordenacao}`).set(auth(coordenacao));

    expect(eventosDe('post:removido').map((e) => e.dados)).toEqual([
      { postId: doAutor },
      { postId: daCoordenacao },
    ]);
  });

  test('quem não pode remover não gera evento', async () => {
    const [a, b] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const post = await request(t.app)
      .post('/posts')
      .set(auth(a))
      .send({ texto: 'Fictícia' });
    const r = await request(t.app).delete(`/posts/${post.body.id}`).set(auth(b));
    expect(r.status).toBe(403);
    expect(eventosDe('post:removido')).toEqual([]);
  });

  test('apelido novo avisa a faculdade; salvar sem mudar o apelido não avisa', async () => {
    const a = await t.cadastrarNovo();
    const eu = auth(a);

    await request(t.app).patch('/eu').set(eu).send({ frase: 'Frase fictícia' });
    await request(t.app).patch('/eu').set(eu).send({ apelido: 'Teste' }); // o mesmo
    expect(eventosDe('perfil:atualizado')).toEqual([]);

    const r = await request(t.app).patch('/eu').set(eu).send({ apelido: 'Apelido Novo' });
    expect(r.status).toBe(200);
    expect(r.body.apelido).toBe('Apelido Novo');
    expect(eventosDe('perfil:atualizado')).toEqual([
      {
        instituicaoId: await faculdadeDe(a),
        evento: 'perfil:atualizado',
        dados: { usuarioId: a.usuario.id },
      },
    ]);
  });

  test('aviso da coordenação avisa só a faculdade dela', async () => {
    const coordenacao = await t.entrar('coordenacao@horizonte.edu.br');
    const r = await request(t.app)
      .post('/coordenacao/avisos')
      .set(auth(coordenacao))
      .send({ titulo: 'Aviso fictício', texto: 'Texto fictício' });
    expect(r.status).toBe(201);
    expect(eventosDe('aviso:novo')).toEqual([
      {
        instituicaoId: await faculdadeDe(coordenacao),
        evento: 'aviso:novo',
        dados: { avisoId: r.body.id },
      },
    ]);
  });

  test('grupo novo avisa a faculdade, só com o id', async () => {
    const a = await t.cadastrarNovo();
    const r = await request(t.app)
      .post('/grupos')
      .set(auth(a))
      .send({ nome: 'Grupo fictício', vagas: 5 });
    expect(r.status).toBe(201);
    expect(eventosDe('grupo:novo')).toEqual([
      {
        instituicaoId: await faculdadeDe(a),
        evento: 'grupo:novo',
        dados: { grupoId: r.body.id },
      },
    ]);
  });
});
