import jwt from 'jsonwebtoken';
import request from 'supertest';
import { appDeTeste, SEGREDO_TESTE } from '../apoio/app';

const t = appDeTeste();
afterAll(() => t.fechar());

const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });

let eu: Awaited<ReturnType<typeof t.cadastrarNovo>>;
beforeAll(async () => {
  eu = await t.cadastrarNovo();
});

describe('autenticação das rotas protegidas', () => {
  test('sem token, token inválido, de outro segredo ou vencido: 401', async () => {
    const forjado = jwt.sign(
      { fac: eu.usuario.id, papel: 'ALUNO' },
      'outro-segredo-qualquer-com-32-caracteres',
      {
        subject: eu.usuario.id,
      },
    );
    const vencido = jwt.sign({ fac: eu.usuario.id, papel: 'ALUNO' }, SEGREDO_TESTE, {
      subject: eu.usuario.id,
      expiresIn: -10,
    });
    const semPapel = jwt.sign({ fac: eu.usuario.id }, SEGREDO_TESTE, {
      subject: eu.usuario.id,
    });

    for (const cabecalho of [
      {},
      { Authorization: 'Basic abc' },
      comToken('abc'),
      comToken(forjado),
      comToken(vencido),
      comToken(semPapel),
    ]) {
      const r = await request(t.app).get('/eu').set(cabecalho);
      expect(r.status).toBe(401);
      expect(r.body.erro).toBe('nao_autenticado');
    }
  });
});

describe('GET e PATCH /eu', () => {
  test('mostra o próprio perfil sem dados sensíveis', async () => {
    const r = await request(t.app).get('/eu').set(comToken(eu.acessoToken));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: eu.usuario.id, email: eu.email });
    expect(r.body.instituicao.sigla).toBe('FH');
    expect(r.body).not.toHaveProperty('senhaHash');
    expect(r.body).not.toHaveProperty('dataNascimento');
  });

  test('atualiza o perfil', async () => {
    const curso = await t.prisma.curso.findFirstOrThrow({
      where: { instituicao: { sigla: 'FH' }, nome: 'Engenharia de Software' },
    });
    const r = await request(t.app)
      .patch('/eu')
      .set(comToken(eu.acessoToken))
      .send({
        apelido: 'Tester',
        cursoId: curso.id,
        semestre: 8,
        turno: 'NOITE',
        frase: 'Bora estudar juntos?',
        interesses: ['xadrez', 'café'],
        horariosLivres: ['ter-noite', 'sab-manha'],
        contatos: { instagram: '@tester' },
      });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      apelido: 'Tester',
      semestre: 8,
      turno: 'NOITE',
      curso: { nome: 'Engenharia de Software' },
      horariosLivres: ['ter-noite', 'sab-manha'],
      contatos: { instagram: '@tester' },
    });
  });

  test('valida os campos e recusa campos desconhecidos', async () => {
    const casos = [
      [{ semestre: 13 }, 'semestre'],
      [{ horariosLivres: ['terça à noite'] }, 'horariosLivres.0'],
      [{ fotoUrl: 'http://inseguro.com/foto.png' }, 'fotoUrl'],
      [{ papel: 'COORDENACAO' }, '_'],
      [{}, '_'],
    ] as const;
    for (const [corpo, campo] of casos) {
      const r = await request(t.app).patch('/eu').set(comToken(eu.acessoToken)).send(corpo);
      expect(r.status).toBe(400);
      expect(r.body.campos[campo]).toBeDefined();
    }
  });

  test('não aceita curso de outra faculdade', async () => {
    const cursoUa = await t.prisma.curso.findFirstOrThrow({
      where: { instituicao: { sigla: 'UA' } },
    });
    const r = await request(t.app)
      .patch('/eu')
      .set(comToken(eu.acessoToken))
      .send({ cursoId: cursoUa.id });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('curso_inexistente');
  });
});

describe('PUT /eu/disciplinas', () => {
  test('substitui a lista de disciplinas', async () => {
    const [calculo, bd] = await Promise.all(
      ['Cálculo I', 'Banco de Dados'].map((nome) =>
        t.prisma.disciplina.findFirstOrThrow({
          where: { instituicao: { sigla: 'FH' }, nome },
        }),
      ),
    );
    const itens = [
      { disciplinaId: calculo!.id, relacao: 'PRECISO_AJUDA' },
      { disciplinaId: bd!.id, relacao: 'POSSO_AJUDAR' },
      { disciplinaId: bd!.id, relacao: 'CURSANDO' },
    ];
    const r = await request(t.app)
      .put('/eu/disciplinas')
      .set(comToken(eu.acessoToken))
      .send({ itens });
    expect(r.status).toBe(200);
    expect(r.body.disciplinas).toHaveLength(3);

    const vazio = await request(t.app)
      .put('/eu/disciplinas')
      .set(comToken(eu.acessoToken))
      .send({ itens: [] });
    expect(vazio.body.disciplinas).toHaveLength(0);
  });

  test('não aceita disciplina de outra faculdade', async () => {
    const outra = await t.prisma.disciplina.findFirstOrThrow({
      where: { instituicao: { sigla: 'UA' } },
    });
    const r = await request(t.app)
      .put('/eu/disciplinas')
      .set(comToken(eu.acessoToken))
      .send({ itens: [{ disciplinaId: outra.id, relacao: 'CURSANDO' }] });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('disciplina_inexistente');
  });
});

describe('GET /usuarios/:id', () => {
  const id = (email: string) =>
    t.prisma.usuario.findUniqueOrThrow({ where: { email } }).then((u) => u.id);

  test('mostra o perfil público de um colega da mesma faculdade', async () => {
    const r = await request(t.app)
      .get(`/usuarios/${await id('bruno.souza@aluno.horizonte.edu.br')}`)
      .set(comToken(eu.acessoToken));
    expect(r.status).toBe(200);
    expect(r.body.apelido).toBe('Bruno');
    expect(r.body.disciplinas.length).toBeGreaterThan(0);
    for (const campo of ['email', 'nome', 'contatos', 'senhaHash', 'dataNascimento']) {
      expect(r.body).not.toHaveProperty(campo);
    }
  });

  test('aluno de outra faculdade e conta da coordenação: 404', async () => {
    for (const email of [
      'bruno.souza@aluno.atlantica.edu.br',
      'coordenacao@horizonte.edu.br',
    ]) {
      const r = await request(t.app)
        .get(`/usuarios/${await id(email)}`)
        .set(comToken(eu.acessoToken));
      expect(r.status).toBe(404);
      expect(r.body.erro).toBe('nao_encontrado');
    }
  });

  test('bloqueio em qualquer sentido esconde o perfil', async () => {
    const outro = await t.cadastrarNovo();
    await t.prisma.bloqueio.create({
      data: {
        instituicaoId: (
          await t.prisma.usuario.findUniqueOrThrow({ where: { id: eu.usuario.id } })
        ).instituicaoId,
        bloqueadorId: outro.usuario.id,
        bloqueadoId: eu.usuario.id,
      },
    });
    const ida = await request(t.app)
      .get(`/usuarios/${outro.usuario.id}`)
      .set(comToken(eu.acessoToken));
    const volta = await request(t.app)
      .get(`/usuarios/${eu.usuario.id}`)
      .set(comToken(outro.acessoToken));
    expect([ida.status, volta.status]).toEqual([404, 404]);
  });

  test('identificador inválido: 400', async () => {
    const r = await request(t.app).get('/usuarios/123').set(comToken(eu.acessoToken));
    expect(r.status).toBe(400);
  });
});

describe('catálogo da faculdade', () => {
  test('lista só os cursos da própria faculdade', async () => {
    const r = await request(t.app).get('/cursos').set(comToken(eu.acessoToken));
    expect(r.status).toBe(200);
    expect(r.body.map((c: { nome: string }) => c.nome)).toEqual([
      'Administração',
      'Ciência da Computação',
      'Engenharia de Software',
    ]);
    const ids = await t.prisma.curso.findMany({
      where: { instituicao: { sigla: 'FH' } },
      select: { id: true },
    });
    expect(r.body.map((c: { id: string }) => c.id).sort()).toEqual(
      ids.map((c) => c.id).sort(),
    );
  });

  test('filtra disciplinas por curso, incluindo as comuns', async () => {
    const curso = await t.prisma.curso.findFirstOrThrow({
      where: { instituicao: { sigla: 'FH' }, nome: 'Administração' },
    });
    const r = await request(t.app)
      .get(`/disciplinas?cursoId=${curso.id}`)
      .set(comToken(eu.acessoToken));
    expect(r.body.map((d: { nome: string }) => d.nome)).toEqual([
      'Contabilidade Geral',
      'Metodologia Científica',
    ]);

    const todas = await request(t.app).get('/disciplinas').set(comToken(eu.acessoToken));
    expect(todas.body).toHaveLength(6);
  });
});
