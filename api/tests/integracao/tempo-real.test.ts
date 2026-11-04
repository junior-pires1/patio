import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as conectar, type Socket } from 'socket.io-client';
import { assinarAcesso } from '../../src/seguranca/tokens';
import { criarTempoReal } from '../../src/tempo-real';
import { SEGREDO_TESTE } from '../apoio/app';

let http: Server;
let tempoReal: ReturnType<typeof criarTempoReal>;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  http = createServer();
  tempoReal = criarTempoReal(http, { segredoJwt: SEGREDO_TESTE, origensPermitidas: ['*'] });
  await new Promise<void>((ok) => http.listen(0, ok));
  url = `http://localhost:${(http.address() as AddressInfo).port}`;
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await tempoReal.fechar();
});

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const FACULDADE = '33333333-3333-4333-8333-333333333333';
const ID_OUTRA = '44444444-4444-4444-8444-444444444444';
const OUTRA_FACULDADE = '55555555-5555-4555-8555-555555555555';

function abrir(token?: string) {
  const s = conectar(url, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(s);
  return s;
}
const tokenDe = (id: string) =>
  assinarAcesso({ id, instituicaoId: FACULDADE, papel: 'ALUNO' }, SEGREDO_TESTE);
const conectado = (s: Socket) =>
  new Promise<void>((ok, falha) => {
    s.once('connect', ok);
    s.once('connect_error', falha);
  });

describe('tempo real (Socket.IO)', () => {
  test('cada pessoa recebe só os eventos enviados para ela', async () => {
    const a = abrir(tokenDe(ID_A));
    const b = abrir(tokenDe(ID_B));
    await Promise.all([conectado(a), conectado(b)]);

    const recebidoPorA = new Promise((ok) => a.once('mensagem:nova', ok));
    let bRecebeu = false;
    b.on('mensagem:nova', () => (bRecebeu = true));

    tempoReal.enviar([ID_A], 'mensagem:nova', { texto: 'oi' });
    expect(await recebidoPorA).toEqual({ texto: 'oi' });
    await new Promise((ok) => setTimeout(ok, 100));
    expect(bRecebeu).toBe(false);
    tempoReal.enviar([], 'mensagem:nova', {}); // lista vazia não envia nada
  });

  test('evento da faculdade chega a todos dela e a ninguém de outra', async () => {
    const a = abrir(tokenDe(ID_A));
    const b = abrir(tokenDe(ID_B));
    const deOutra = abrir(
      assinarAcesso(
        { id: ID_OUTRA, instituicaoId: OUTRA_FACULDADE, papel: 'ALUNO' },
        SEGREDO_TESTE,
      ),
    );
    await Promise.all([conectado(a), conectado(b), conectado(deOutra)]);

    const recebidos = Promise.all(
      [a, b].map((s) => new Promise((ok) => s.once('post:novo', ok))),
    );
    let outraRecebeu = false;
    deOutra.on('post:novo', () => (outraRecebeu = true));

    tempoReal.enviarFaculdade(FACULDADE, 'post:novo', { postId: 'x' });
    expect(await recebidos).toEqual([{ postId: 'x' }, { postId: 'x' }]);
    await new Promise((ok) => setTimeout(ok, 100));
    expect(outraRecebeu).toBe(false);
  });

  test('sem token ou com token inválido a conexão é recusada', async () => {
    await expect(conectado(abrir())).rejects.toThrow('nao_autenticado');
    await expect(conectado(abrir('token-falso'))).rejects.toThrow('nao_autenticado');
  });
});

describe('conta inativa no tempo real', () => {
  test('conta suspensa não conecta, mesmo com token válido', async () => {
    const servidor = createServer();
    const comConferencia = criarTempoReal(servidor, {
      segredoJwt: SEGREDO_TESTE,
      origensPermitidas: ['*'],
      contaAtiva: async (u) => u.id !== ID_B,
    });
    await new Promise<void>((ok) => servidor.listen(0, ok));
    const endereco = `http://localhost:${(servidor.address() as AddressInfo).port}`;
    const abrirEm = (token: string) => {
      const s = conectar(endereco, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(s);
      return s;
    };
    await conectado(abrirEm(tokenDe(ID_A)));
    await expect(conectado(abrirEm(tokenDe(ID_B)))).rejects.toThrow();
    await comConferencia.fechar();
  });
});
