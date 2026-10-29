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

  test('sem token ou com token inválido a conexão é recusada', async () => {
    await expect(conectado(abrir())).rejects.toThrow('nao_autenticado');
    await expect(conectado(abrir('token-falso'))).rejects.toThrow('nao_autenticado');
  });
});
