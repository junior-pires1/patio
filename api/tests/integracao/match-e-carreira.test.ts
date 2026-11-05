import request from 'supertest';
import { appDeTeste } from '../apoio/app';

// Rodadas 3 e 4: super curtida, desfazer pulo, filtros e % de afinidade;
// seguir, quem viu seu perfil, certificados e vagas com candidaturas.

const t = appDeTeste();
afterAll(() => t.fechar());

type Sessao = Awaited<ReturnType<typeof t.cadastrarNovo>>;
const auth = (s: { acessoToken: string }) => ({ Authorization: `Bearer ${s.acessoToken}` });
const tiposDe = async (s: Sessao) =>
  (
    (await request(t.app).get('/notificacoes').set(auth(s))).body.notificacoes as {
      tipo: string;
      texto: string | null;
    }[]
  ).map((n) => n.tipo);

describe('super curtida', () => {
  test('aparece primeiro para quem recebe, avisa e tem limite de 3 por dia', async () => {
    const [eu, a, b, c, d] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    expect((await request(t.app).get('/eu/super-curtidas').set(auth(eu))).body).toEqual({
      restantes: 3,
      porDia: 3,
    });
    for (const alvo of [a, b, c]) {
      const r = await request(t.app)
        .post('/curtidas')
        .set(auth(eu))
        .send({ paraId: alvo.usuario.id, super: true });
      expect(r.status).toBe(201);
    }
    const quarta = await request(t.app)
      .post('/curtidas')
      .set(auth(eu))
      .send({ paraId: d.usuario.id, super: true });
    expect(quarta.status).toBe(429);
    expect(quarta.body.erro).toBe('limite_super');
    expect(
      (await request(t.app).get('/eu/super-curtidas').set(auth(eu))).body.restantes,
    ).toBe(0);

    // Para quem recebeu: o card vem primeiro, marcado, e chegou a notificação.
    const cartas = (await request(t.app).get('/descobrir').set(auth(a))).body;
    expect(cartas[0].id).toBe(eu.usuario.id);
    expect(cartas[0].superCurtiuVoce).toBe(true);
    expect(cartas[0].afinidade.percentual).toEqual(expect.any(Number));
    expect(await tiposDe(a)).toContain('SUPER_CURTIDA');
    const recebidas = (await request(t.app).get('/eu/curtidas/recebidas').set(auth(a)))
      .body;
    expect(recebidas[0]).toMatchObject({ super: true });
  });
});

describe('desfazer pulo', () => {
  test('o último pulo volta para a pilha; sem pulo, 404', async () => {
    const [eu, outro] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    await request(t.app).post('/pulos').set(auth(eu)).send({ paraId: outro.usuario.id });
    let ids = (await request(t.app).get('/descobrir').set(auth(eu))).body.map(
      (c: { id: string }) => c.id,
    );
    expect(ids).not.toContain(outro.usuario.id);
    const r = await request(t.app).delete('/pulos/ultimo').set(auth(eu));
    expect(r.status).toBe(200);
    expect(r.body.paraId).toBe(outro.usuario.id);
    ids = (await request(t.app).get('/descobrir').set(auth(eu))).body.map(
      (c: { id: string }) => c.id,
    );
    expect(ids).toContain(outro.usuario.id);
    expect((await request(t.app).delete('/pulos/ultimo').set(auth(eu))).status).toBe(404);
  });
});

describe('filtros do descobrir', () => {
  test('turno e faixa de semestre', async () => {
    const eu = await t.cadastrarNovo();
    const r = await request(t.app)
      .get('/descobrir?turno=NOITE&semestreMin=2&semestreMax=5')
      .set(auth(eu));
    expect(r.status).toBe(200);
    for (const c of r.body as { semestre: number | null }[]) {
      expect(c.semestre).toBeGreaterThanOrEqual(2);
      expect(c.semestre).toBeLessThanOrEqual(5);
    }
    const turnos = await t.prisma.usuario.findMany({
      where: { id: { in: r.body.map((c: { id: string }) => c.id) } },
      select: { turno: true },
    });
    expect(turnos.every((u) => u.turno === 'NOITE')).toBe(true);
    expect(
      (await request(t.app).get('/descobrir?semestreMin=abc').set(auth(eu))).status,
    ).toBe(400);
  });
});

describe('seguir', () => {
  test('seguir conta no perfil, avisa, lista e o feed "Seguindo" mostra só quem sigo', async () => {
    const [eu, autor, outro] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    const r = await request(t.app)
      .put(`/usuarios/${autor.usuario.id}/seguir`)
      .set(auth(eu));
    expect(r.body).toEqual({ euSigo: true, seguidores: 1 });
    // Seguir de novo não duplica nem avisa outra vez.
    await request(t.app).put(`/usuarios/${autor.usuario.id}/seguir`).set(auth(eu));
    expect((await tiposDe(autor)).filter((x) => x === 'NOVO_SEGUIDOR')).toHaveLength(1);

    const perfil = (
      await request(t.app).get(`/usuarios/${autor.usuario.id}/perfil`).set(auth(eu))
    ).body;
    expect(perfil.contadores.seguidores).toBe(1);
    expect(perfil.relacao.euSigo).toBe(true);
    const lista = (
      await request(t.app).get(`/usuarios/${autor.usuario.id}/seguidores`).set(auth(eu))
    ).body;
    expect(lista.map((p: { id: string }) => p.id)).toEqual([eu.usuario.id]);
    const sigo = (
      await request(t.app).get(`/usuarios/${eu.usuario.id}/seguindo`).set(auth(eu))
    ).body;
    expect(sigo.map((p: { id: string }) => p.id)).toEqual([autor.usuario.id]);

    await request(t.app).post('/posts').set(auth(autor)).send({ texto: 'De quem eu sigo' });
    await request(t.app).post('/posts').set(auth(outro)).send({ texto: 'De outra pessoa' });
    const feed = (await request(t.app).get('/feed?aba=seguindo').set(auth(eu))).body.posts;
    const autores = new Set(feed.map((p: { autor: { id: string } }) => p.autor.id));
    expect([...autores]).toEqual([autor.usuario.id]);

    const deixar = await request(t.app)
      .delete(`/usuarios/${autor.usuario.id}/seguir`)
      .set(auth(eu));
    expect(deixar.body).toEqual({ euSigo: false, seguidores: 0 });
    expect(
      (await request(t.app).put(`/usuarios/${eu.usuario.id}/seguir`).set(auth(eu))).status,
    ).toBe(422);
  });
});

describe('quem viu seu perfil', () => {
  test('visitas contam uma por dia por pessoa e não contam a própria pessoa', async () => {
    const [eu, a, b] = await Promise.all([
      t.cadastrarNovo(),
      t.cadastrarNovo(),
      t.cadastrarNovo(),
    ]);
    await request(t.app).get(`/usuarios/${eu.usuario.id}/perfil`).set(auth(a));
    await request(t.app).get(`/usuarios/${eu.usuario.id}/perfil`).set(auth(a));
    await request(t.app).get(`/usuarios/${eu.usuario.id}/perfil`).set(auth(b));
    await request(t.app).get(`/usuarios/${eu.usuario.id}/perfil`).set(auth(eu));
    const r = (await request(t.app).get('/eu/visitas').set(auth(eu))).body;
    expect(r.total).toBe(2);
    expect(r.pessoasDiferentes).toBe(2);
    expect(r.porDia).toHaveLength(1);
    expect(r.visitantes.map((v: { pessoa: { id: string } }) => v.pessoa.id).sort()).toEqual(
      [a.usuario.id, b.usuario.id].sort(),
    );
  });
});

describe('certificados', () => {
  test('experiência do tipo certificado com link; link inválido é recusado', async () => {
    const eu = await t.cadastrarNovo();
    const ok = await request(t.app).post('/eu/experiencias').set(auth(eu)).send({
      tipo: 'CERTIFICADO',
      titulo: 'Git e GitHub',
      organizacao: 'Alura',
      inicio: '2026-03-01',
      link: 'https://cursos.alura.com.br/certificate/abc',
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      tipo: 'CERTIFICADO',
      link: expect.stringMatching(/^https/),
    });
    const ruim = await request(t.app).post('/eu/experiencias').set(auth(eu)).send({
      tipo: 'CERTIFICADO',
      titulo: 'Outro',
      inicio: '2026-03-01',
      link: 'javascript:alert(1)',
    });
    expect(ruim.status).toBe(400);
  });
});

describe('vagas e candidaturas', () => {
  const vaga = {
    tipo: 'ESTAGIO',
    titulo: 'Estágio em desenvolvimento web',
    organizacao: 'Fábrica de Software',
    descricao: 'Ajudar no front-end do Pátio com React Native.',
    modalidade: 'HIBRIDO',
  };

  test('publicar, candidatar, ver candidatos, aprovar e avisar', async () => {
    const [autor, aluno] = await Promise.all([t.cadastrarNovo(), t.cadastrarNovo()]);
    const criada = await request(t.app).post('/vagas').set(auth(autor)).send(vaga);
    expect(criada.status).toBe(201);
    expect(criada.body).toMatchObject({ aberta: true, minha: true, candidatos: 0 });
    const id = criada.body.id as string;

    const vista = (await request(t.app).get(`/vagas/${id}`).set(auth(aluno))).body;
    expect(vista).toMatchObject({ minha: false, candidatos: null, minhaCandidatura: null });
    const lista = (await request(t.app).get('/vagas?tipo=ESTAGIO').set(auth(aluno))).body;
    expect(lista.map((v: { id: string }) => v.id)).toContain(id);

    const c = await request(t.app)
      .post(`/vagas/${id}/candidatura`)
      .set(auth(aluno))
      .send({ mensagem: 'Já fiz dois projetos em React.' });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe('ENVIADA');
    expect(
      (await request(t.app).post(`/vagas/${id}/candidatura`).set(auth(aluno)).send({}))
        .status,
    ).toBe(409);
    expect(
      (await request(t.app).post(`/vagas/${id}/candidatura`).set(auth(autor)).send({}))
        .status,
    ).toBe(422);
    expect(await tiposDe(autor)).toContain('CANDIDATURA_NOVA');

    // Só quem publicou vê os candidatos.
    expect(
      (await request(t.app).get(`/vagas/${id}/candidatos`).set(auth(aluno))).status,
    ).toBe(403);
    const candidatos = (
      await request(t.app).get(`/vagas/${id}/candidatos`).set(auth(autor))
    ).body;
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0]).toMatchObject({
      mensagem: 'Já fiz dois projetos em React.',
      usuario: { id: aluno.usuario.id },
    });

    const aprovada = await request(t.app)
      .put(`/vagas/${id}/candidatos/${aluno.usuario.id}`)
      .set(auth(autor))
      .send({ status: 'APROVADA' });
    expect(aprovada.body.status).toBe('APROVADA');
    expect(await tiposDe(aluno)).toContain('CANDIDATURA_ATUALIZADA');

    const minhas = (await request(t.app).get('/vagas?lado=candidaturas').set(auth(aluno)))
      .body;
    expect(minhas[0]).toMatchObject({ id, minhaCandidatura: { status: 'APROVADA' } });

    // Encerrada: some das abertas e não aceita candidatura nova.
    const encerrada = await request(t.app).post(`/vagas/${id}/encerrar`).set(auth(autor));
    expect(encerrada.body.aberta).toBe(false);
    const abertas = (await request(t.app).get('/vagas').set(auth(aluno))).body;
    expect(abertas.map((v: { id: string }) => v.id)).not.toContain(id);
    const outro = await t.cadastrarNovo();
    expect(
      (await request(t.app).post(`/vagas/${id}/candidatura`).set(auth(outro)).send({}))
        .status,
    ).toBe(422);
  });

  test('coordenação publica e gerencia; outra faculdade não vê; validações', async () => {
    const coord = await t.entrar('coordenacao@horizonte.edu.br');
    const deFora = await t.cadastrarNovo('aluno.atlantica.edu.br');
    const criada = await request(t.app)
      .post('/vagas')
      .set(auth(coord))
      .send({ ...vaga, tipo: 'MONITORIA', prazo: '2099-12-31' });
    expect(criada.status).toBe(201);
    expect(criada.body.prazo).toBe('2099-12-31');
    expect(
      (await request(t.app).get(`/vagas/${criada.body.id}`).set(auth(deFora))).status,
    ).toBe(404);
    const ruim = await request(t.app)
      .post('/vagas')
      .set(auth(coord))
      .send({ ...vaga, tipo: 'NAMORO', descricao: 'curta' });
    expect(ruim.status).toBe(400);
    expect(Object.keys(ruim.body.campos)).toEqual(
      expect.arrayContaining(['tipo', 'descricao']),
    );
  });
});
