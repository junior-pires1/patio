/* eslint-disable no-console -- script de terminal: o progresso vai para a tela */
/**
 * Popula uma faculdade de demonstração (por exemplo, a UNG) pela API, como
 * se fossem pessoas usando o app: a coordenação cadastra cursos, disciplinas,
 * avisos e alunos; cada aluno completa o perfil, publica, curte, comenta,
 * conversa, entra em grupos e publica stories.
 *
 * Uso (na pasta api):
 *   npm run popular -- --coordenacao coordenacao@ung.br
 *
 * Opções:
 *   --api <url>            API (padrão: a do Render)
 *   --coordenacao <email>  conta da coordenação da faculdade (obrigatório)
 *   --dominio <dominio>    domínio dos e-mails dos alunos (padrão: aluno.<domínio da coordenação>)
 *   --alunos <n>           quantos alunos de demonstração (padrão: 40)
 *   --senha-demo <senha>   senha das contas de demonstração (padrão: PatioDemo2026)
 *   --sem-curtir-reais     não curtir as contas reais da faculdade
 *   --stories              só publica stories novos nas contas de demonstração que já
 *                          existem (os stories somem em 24 horas: rode na véspera da apresentação)
 *
 * A senha da coordenação é pedida no terminal (ou em PATIO_SENHA_COORDENACAO).
 * Os alunos de demonstração têm e-mail começando com "demo." e nomes fictícios.
 */
import { deflateSync } from 'node:zlib';
import { stdin, stdout } from 'node:process';
import * as D from './dados-demonstracao';

// ───────────── Opções ─────────────

function opcao(nome: string, padrao?: string) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
}
const API = (opcao('api', 'https://patio-api-llzk.onrender.com') ?? '').replace(/\/$/, '');
const COORDENACAO = opcao('coordenacao');
const TOTAL = Number(opcao('alunos', '40'));
const SENHA_DEMO = opcao('senha-demo', 'PatioDemo2026')!;
const CURTIR_REAIS = !process.argv.includes('--sem-curtir-reais');
const SO_STORIES = process.argv.includes('--stories');
if (!COORDENACAO) {
  console.error('Informe a conta da coordenação: --coordenacao coordenacao@ung.br');
  process.exit(1);
}
const DOMINIO = opcao('dominio', `aluno.${COORDENACAO.split('@')[1]}`)!;

// ───────────── Sorteios repetíveis ─────────────

let semente = 20261104;
function aleatorio() {
  semente = (semente * 1664525 + 1013904223) % 4294967296;
  return semente / 4294967296;
}
const inteiro = (min: number, max: number) =>
  min + Math.floor(aleatorio() * (max - min + 1));
const um = <T>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)]!;
function alguns<T>(lista: readonly T[], n: number): T[] {
  const copia = [...lista];
  const saida: T[] = [];
  while (saida.length < n && copia.length)
    saida.push(copia.splice(inteiro(0, copia.length - 1), 1)[0]!);
  return saida;
}
const chance = (p: number) => aleatorio() < p;
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ───────────── Imagens geradas (PNG com degradê e círculos) ─────────────

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(dados: Buffer) {
  let c = 0xffffffff;
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo: string, dados: Buffer) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}
const PALETAS: [number, number, number][][] = [
  [
    [31, 111, 235],
    [126, 87, 194],
  ],
  [
    [14, 124, 102],
    [56, 189, 248],
  ],
  [
    [181, 70, 47],
    [251, 191, 36],
  ],
  [
    [236, 72, 153],
    [99, 102, 241],
  ],
  [
    [15, 23, 42],
    [20, 184, 166],
  ],
  [
    [234, 88, 12],
    [190, 24, 93],
  ],
];
function imagem(largura: number, altura: number): Buffer {
  const [a, b] = um(PALETAS);
  const circulos = Array.from({ length: inteiro(2, 5) }, () => ({
    x: inteiro(0, largura),
    y: inteiro(0, altura),
    r: inteiro(largura / 8, largura / 3),
  }));
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura * 3 + 1);
    for (let x = 0; x < largura; x++) {
      const t = (x / largura + y / altura) / 2;
      let claro = 0;
      for (const c of circulos)
        if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.r ** 2) claro += 0.12;
      for (let k = 0; k < 3; k++) {
        const v = a![k]! * (1 - t) + b![k]! * t;
        linhas[base + 1 + x * 3 + k] = Math.min(255, Math.round(v + (255 - v) * claro));
      }
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// ───────────── Conversa com a API ─────────────

type Sessao = { acessoToken: string; usuario: { id: string; apelido: string } };
class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly corpo: { erro?: string; mensagem?: string },
  ) {
    super(`${status} ${corpo.erro ?? ''} ${corpo.mensagem ?? ''}`.trim());
  }
}
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function chamar<T>(
  metodo: string,
  caminho: string,
  { token, corpo, bytes }: { token?: string; corpo?: unknown; bytes?: Buffer } = {},
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(`${API}${caminho}`, {
        method: metodo,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(bytes ? { 'Content-Type': 'image/png' } : {}),
          ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: bytes ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
      });
    } catch (e) {
      if (tentativa >= 6) throw e;
      await espera(5000);
      continue;
    }
    // Muitas requisições ou servidor acordando: espera e tenta de novo.
    if ((resposta.status === 429 || resposta.status >= 502) && tentativa < 8) {
      await espera(resposta.status === 429 ? 20_000 : 5000);
      continue;
    }
    const texto = await resposta.text();
    const dados = texto
      ? (JSON.parse(texto) as T & { erro?: string; mensagem?: string })
      : null;
    if (!resposta.ok) throw new ErroDaApi(resposta.status, dados ?? {});
    return dados as T;
  }
}

/** Executa as tarefas com no máximo `n` ao mesmo tempo. */
async function emParalelo<T>(
  itens: T[],
  n: number,
  tarefa: (item: T, i: number) => Promise<void>,
) {
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        await tarefa(itens[i]!, i);
      }
    }),
  );
}

const ignorarSe = async (codigos: number[], acao: () => Promise<unknown>) => {
  try {
    await acao();
  } catch (e) {
    if (!(e instanceof ErroDaApi) || !codigos.includes(e.status)) throw e;
  }
};

async function perguntarSenha(): Promise<string> {
  if (process.env.PATIO_SENHA_COORDENACAO) return process.env.PATIO_SENHA_COORDENACAO;
  stdout.write(`Senha de ${COORDENACAO}: `);
  return new Promise((ok) => {
    let senha = '';
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const aoDigitar = (tecla: string) => {
      for (const c of tecla) {
        if (c === '\r' || c === '\n') {
          stdin.off('data', aoDigitar);
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          return ok(senha);
        }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f' || c === '\b') senha = senha.slice(0, -1);
        else senha += c;
      }
    };
    stdin.on('data', aoDigitar);
  });
}

// ───────────── Roteiro ─────────────

type Aluno = {
  nome: string;
  apelido: string;
  email: string;
  curso: number;
  sessao?: Sessao;
};

async function principal() {
  console.log(`API: ${API}`);
  process.stdout.write('Acordando o servidor... ');
  await chamar('GET', '/saude');
  console.log('ok');

  const senha = await perguntarSenha();
  const coord = await chamar<Sessao & { usuario: { instituicao: { nome: string } } }>(
    'POST',
    '/auth/login',
    { corpo: { email: COORDENACAO, senha } },
  );
  const tc = coord.acessoToken;
  console.log(`Coordenação: ${coord.usuario.instituicao.nome}`);

  // 1) Cursos e disciplinas
  const cursosAntes = await chamar<{ id: string; nome: string }[]>('GET', '/cursos', {
    token: tc,
  });
  const cursos: string[] = [];
  for (const nome of D.CURSOS) {
    const existe = cursosAntes.find((c) => c.nome === nome);
    cursos.push(
      existe?.id ??
        (
          await chamar<{ id: string }>('POST', '/coordenacao/cursos', {
            token: tc,
            corpo: { nome },
          })
        ).id,
    );
  }
  const disciplinasAntes = await chamar<{ id: string; nome: string }[]>(
    'GET',
    '/disciplinas',
    {
      token: tc,
    },
  );
  const disciplinas = new Map(disciplinasAntes.map((d) => [d.nome, d.id]));
  for (const [nome, curso] of D.DISCIPLINAS) {
    if (disciplinas.has(nome)) continue;
    const d = await chamar<{ id: string }>('POST', '/coordenacao/disciplinas', {
      token: tc,
      corpo: { nome, cursoId: curso === null ? null : cursos[curso] },
    });
    disciplinas.set(nome, d.id);
  }
  const idsDisciplinas = [...disciplinas.values()];
  console.log(`Cursos: ${cursos.length} · disciplinas: ${disciplinas.size}`);

  // 2) Avisos
  const avisos = await chamar<{ titulo: string }[]>('GET', '/avisos', { token: tc });
  for (const a of D.AVISOS) {
    if (avisos.some((x) => x.titulo === a.titulo)) continue;
    await chamar('POST', '/coordenacao/avisos', { token: tc, corpo: a });
  }

  // 3) Contas reais da faculdade (para receberem curtidas)
  const reais = (
    await chamar<{ itens: { id: string; email: string; status: string }[] }>(
      'GET',
      '/coordenacao/alunos?pagina=1',
      { token: tc },
    )
  ).itens.filter((a) => !a.email.startsWith('demo.') && a.status === 'ATIVA');

  // 4) Alunos de demonstração
  const usados = new Set<string>();
  const alunos: Aluno[] = [];
  while (alunos.length < TOTAL) {
    const nome = `${um(D.NOMES)} ${um(D.SOBRENOMES)} ${um(D.SOBRENOMES)}`;
    const [primeiro, , ultimo] = nome.split(' ');
    const email = `demo.${semAcento(primeiro!)}.${semAcento(ultimo!)}@${DOMINIO}`;
    if (usados.has(email)) continue;
    usados.add(email);
    alunos.push({ nome, apelido: primeiro!, email, curso: inteiro(0, cursos.length - 1) });
  }

  let novos = 0;
  await emParalelo(alunos, 3, async (a) => {
    try {
      const criado = await chamar<{ senhaProvisoria: string }>(
        'POST',
        '/coordenacao/alunos',
        {
          token: tc,
          corpo: {
            nome: a.nome,
            apelido: a.apelido,
            email: a.email,
            dataNascimento: `${inteiro(1996, 2006)}-0${inteiro(1, 9)}-${inteiro(10, 28)}`,
            cursoId: cursos[a.curso],
          },
        },
      );
      const s = await chamar<Sessao>('POST', '/auth/login', {
        corpo: { email: a.email, senha: criado.senhaProvisoria },
      });
      a.sessao = await chamar<Sessao>('PUT', '/auth/senha', {
        token: s.acessoToken,
        corpo: { senhaAtual: criado.senhaProvisoria, novaSenha: SENHA_DEMO },
      });
      novos++;
    } catch (e) {
      if (!(e instanceof ErroDaApi) || e.status !== 409) throw e;
      // Já existia (script rodado antes): entra com a senha de demonstração.
      a.sessao = await chamar<Sessao>('POST', '/auth/login', {
        corpo: { email: a.email, senha: SENHA_DEMO },
      });
    }
    process.stdout.write('.');
  });
  console.log(`\nAlunos de demonstração: ${alunos.length} (${novos} novos)`);
  const comSessao = alunos.filter((a): a is Aluno & { sessao: Sessao } =>
    Boolean(a.sessao),
  );
  const enviarImagem = async (t: string, largura: number, altura: number) =>
    (
      await chamar<{ id: string }>('POST', '/imagens', {
        token: t,
        bytes: imagem(largura, altura),
      })
    ).id;

  if (SO_STORIES) {
    console.log(`Stories novos: ${await publicarStories(comSessao, enviarImagem)}`);
    return;
  }
  if (novos === 0) {
    console.log('A faculdade já tinha os alunos de demonstração: nada mais a fazer.');
    console.log('Para renovar só os stories, rode de novo com --stories.');
    return;
  }

  // 5) Perfis completos
  await emParalelo(comSessao, 4, async (a) => {
    const t = a.sessao.acessoToken;
    const habilidades = alguns(D.HABILIDADES, inteiro(2, 6));
    await chamar('PATCH', '/eu', {
      token: t,
      corpo: {
        semestre: inteiro(1, 8),
        turno: um(D.TURNOS),
        frase: um(D.FRASES),
        sobre: chance(0.7) ? um(D.SOBRE) : null,
        objetivos: alguns(D.OBJETIVOS, inteiro(1, 3)),
        interesses: alguns(D.INTERESSES, inteiro(2, 5)),
        habilidades,
        horariosLivres: alguns(D.DIAS, inteiro(1, 3)).map((d) => `${d}-${um(D.PERIODOS)}`),
      },
    });
    const escolhidas = alguns(idsDisciplinas, 6);
    await chamar('PUT', '/eu/disciplinas', {
      token: t,
      corpo: {
        itens: [
          ...escolhidas
            .slice(0, 3)
            .map((disciplinaId) => ({ disciplinaId, relacao: 'CURSANDO' })),
          ...escolhidas
            .slice(3, 5)
            .map((disciplinaId) => ({ disciplinaId, relacao: 'POSSO_AJUDAR' })),
          ...escolhidas
            .slice(5)
            .map((disciplinaId) => ({ disciplinaId, relacao: 'PRECISO_AJUDA' })),
        ],
      },
    });
    for (const e of alguns(D.EXPERIENCIAS, inteiro(0, 2))) {
      const ano = inteiro(2023, 2026);
      await chamar('POST', '/eu/experiencias', {
        token: t,
        corpo: {
          ...e,
          inicio: `${ano}-0${inteiro(1, 9)}-01`,
          fim: chance(0.5) ? null : `${Math.min(ano + 1, 2026)}-1${inteiro(0, 2)}-01`,
        },
      });
    }
    if (chance(0.5)) {
      await chamar('PUT', '/eu/foto', { token: t, bytes: imagem(256, 256) });
    }
  });
  console.log('Perfis completos');

  // 6) Publicações, curtidas e comentários
  const posts: string[] = [];
  await emParalelo(comSessao, 3, async (a) => {
    const quantos = inteiro(1, 3);
    for (let i = 0; i < quantos; i++) {
      const p = um(D.POSTS);
      const evento = p.evento
        ? {
            eventoInicio: new Date(Date.now() + p.evento.dias * 86_400_000).toISOString(),
            eventoLocal: p.evento.local,
          }
        : {};
      const comImagem = chance(0.35);
      const imagemId = comImagem
        ? await enviarImagem(a.sessao.acessoToken, 800, 600)
        : undefined;
      const post = await chamar<{ id: string }>('POST', '/posts', {
        token: a.sessao.acessoToken,
        corpo: { categoria: p.categoria, texto: p.texto, imagemId, ...evento },
      });
      posts.push(post.id);
    }
  });
  console.log(`Publicações: ${posts.length}`);

  await emParalelo(comSessao, 4, async (a) => {
    const t = a.sessao.acessoToken;
    for (const id of alguns(posts, inteiro(3, 10))) {
      await ignorarSe([404], () => chamar('PUT', `/posts/${id}/curtida`, { token: t }));
    }
    for (const id of alguns(posts, inteiro(0, 3))) {
      await ignorarSe([404], () =>
        chamar('POST', `/posts/${id}/comentarios`, {
          token: t,
          corpo: { texto: um(D.COMENTARIOS) },
        }),
      );
    }
  });
  console.log('Curtidas e comentários');

  // 7) Conexões (curtidas dos dois lados), conversas e recomendações
  let conexoes = 0;
  for (let i = 0; i < comSessao.length; i++) {
    const a = comSessao[i]!;
    for (const b of alguns(comSessao.slice(i + 1), inteiro(0, 3))) {
      await ignorarSe([404, 409], () =>
        chamar('POST', '/curtidas', {
          token: a.sessao.acessoToken,
          corpo: { paraId: b.sessao.usuario.id },
        }),
      );
      if (!chance(0.65)) continue; // fica só a curtida de A, esperando resposta
      const r = await chamar<{ match: { id: string } | null }>('POST', '/curtidas', {
        token: b.sessao.acessoToken,
        corpo: { paraId: a.sessao.usuario.id },
      });
      if (!r.match) continue;
      conexoes++;
      if (chance(0.6)) {
        const conversa = um(D.CONVERSAS);
        for (const [k, texto] of conversa.entries()) {
          await chamar('POST', `/matches/${r.match.id}/mensagens`, {
            token: (k % 2 === 0 ? a : b).sessao.acessoToken,
            corpo: { texto },
          });
        }
      }
      const perfilB = await chamar<{ habilidades: string[] }>(
        'GET',
        `/usuarios/${b.sessao.usuario.id}/perfil`,
        { token: a.sessao.acessoToken },
      );
      for (const habilidade of alguns(perfilB.habilidades, inteiro(0, 2))) {
        await chamar('PUT', `/usuarios/${b.sessao.usuario.id}/recomendacoes`, {
          token: a.sessao.acessoToken,
          corpo: { habilidade },
        });
      }
    }
  }
  console.log(`Conexões: ${conexoes}`);

  // 8) Curtidas nas contas reais (sem criar conexão: elas decidem se curtem de volta)
  if (CURTIR_REAIS && reais.length > 0) {
    for (const a of comSessao) {
      for (const r of alguns(reais, inteiro(0, Math.min(3, reais.length)))) {
        await ignorarSe([404, 409], () =>
          chamar('POST', '/curtidas', {
            token: a.sessao.acessoToken,
            corpo: { paraId: r.id },
          }),
        );
      }
    }
    console.log(`Curtidas para as ${reais.length} contas reais`);
  }

  // 9) Grupos de estudo com conversas
  for (const g of D.GRUPOS) {
    const [criador, ...outros] = alguns(comSessao, inteiro(4, 9));
    const grupo = await chamar<{ id: string }>('POST', '/grupos', {
      token: criador!.sessao.acessoToken,
      corpo: {
        nome: g.nome,
        disciplinaId: disciplinas.get(g.disciplina),
        encontro: g.encontro,
        local: g.local,
        vagas: inteiro(10, 15),
        descricao: 'Grupo aberto: chega mais!',
      },
    });
    for (const m of outros) {
      await ignorarSe([409, 422], () =>
        chamar('POST', `/grupos/${grupo.id}/entrar`, { token: m.sessao.acessoToken }),
      );
    }
    for (const texto of alguns(D.MENSAGENS_GRUPO, inteiro(2, 5))) {
      await chamar('POST', `/grupos/${grupo.id}/mensagens`, {
        token: um([criador!, ...outros]).sessao.acessoToken,
        corpo: { texto },
      });
    }
  }
  console.log(`Grupos: ${D.GRUPOS.length}`);

  // 10) Stories (somem em 24 horas) e alguns destaques
  console.log(`Stories: ${await publicarStories(comSessao, enviarImagem, true)}`);

  console.log('\nPronto! Contas de demonstração:');
  console.log(`  e-mail: demo.<nome>.<sobrenome>@${DOMINIO} · senha: ${SENHA_DEMO}`);
  console.log(`  exemplo: ${comSessao[0]?.email}`);
}

/** Metade dos alunos publica de 1 a 3 stories; com `destaques`, alguns viram destaque. */
async function publicarStories(
  comSessao: (Aluno & { sessao: Sessao })[],
  enviarImagem: (t: string, largura: number, altura: number) => Promise<string>,
  destaques = false,
) {
  let stories = 0;
  await emParalelo(alguns(comSessao, Math.ceil(comSessao.length / 2)), 3, async (a) => {
    const t = a.sessao.acessoToken;
    const ids: string[] = [];
    const quantos = inteiro(1, 3);
    for (let i = 0; i < quantos; i++) {
      const story = await chamar<{ id: string }>('POST', '/stories', {
        token: t,
        corpo: {
          imagemId: await enviarImagem(t, 540, 960),
          legenda: um(D.LEGENDAS) ?? undefined,
        },
      });
      ids.push(story.id);
      stories++;
    }
    if (destaques && chance(0.5)) {
      await chamar('POST', '/destaques', {
        token: t,
        corpo: { titulo: um(['Projetos', 'Campus', 'Eventos', 'Estudos']), storyIds: ids },
      });
    }
  });
  return stories;
}

principal().catch((e: unknown) => {
  console.error('\nFalhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
