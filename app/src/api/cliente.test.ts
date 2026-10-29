import { criarCliente, ErroApi, type Armazenamento } from './cliente';

function memoria(inicial: string | null = null): Armazenamento & { valor: string | null } {
  return {
    valor: inicial,
    async ler() {
      return this.valor;
    },
    async gravar(v) {
      this.valor = v;
    },
  };
}

const json = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sessao = (n: number) => ({
  acessoToken: `acesso-${n}`,
  refreshToken: `renovacao-${n}`,
  expiraEmSegundos: 900,
  usuario: { id: 'u1' },
});

describe('cliente da API', () => {
  test('login guarda a renovação e usa o token de acesso nas chamadas', async () => {
    const armazenamento = memoria();
    const fetch = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.endsWith('/auth/login')) return json(200, sessao(1));
      const auth = (init?.headers as Record<string, string>).Authorization;
      return json(200, { auth });
    });
    const api = criarCliente({ baseUrl: 'http://api', armazenamento, fetch });

    await api.entrar('a@b.edu.br', 'senha123');
    expect(armazenamento.valor).toBe('renovacao-1');
    expect(await api.get('/eu')).toEqual({ auth: 'Bearer acesso-1' });
  });

  test('erro da API vira ErroApi com código e campos', async () => {
    const fetch = vi.fn(async () =>
      json(400, {
        erro: 'dados_invalidos',
        mensagem: 'Confira',
        campos: { email: 'inválido' },
      }),
    );
    const api = criarCliente({ baseUrl: 'http://api', armazenamento: memoria(), fetch });
    const erro = await api.post('/auth/codigo', {}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({
      status: 400,
      codigo: 'dados_invalidos',
      campos: { email: 'inválido' },
    });
  });

  test('sem internet vira erro amigável', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const api = criarCliente({ baseUrl: 'http://api', armazenamento: memoria(), fetch });
    await expect(api.get('/saude')).rejects.toMatchObject({ codigo: 'sem_conexao' });
  });

  test('token vencido: renova uma vez só, mesmo com chamadas simultâneas', async () => {
    const armazenamento = memoria();
    let renovacoes = 0;
    const fetch = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const auth = (init?.headers as Record<string, string>).Authorization;
      if (url.endsWith('/auth/login')) return json(200, sessao(1));
      if (url.endsWith('/auth/renovar')) {
        renovacoes++;
        return json(200, sessao(2));
      }
      return auth === 'Bearer acesso-2'
        ? json(200, { ok: true })
        : json(401, { erro: 'nao_autenticado' });
    });
    const api = criarCliente({ baseUrl: 'http://api', armazenamento, fetch });
    await api.entrar('a@b.edu.br', 'senha123');

    const respostas = await Promise.all([
      api.get('/eu'),
      api.get('/matches'),
      api.get('/descobrir'),
    ]);
    expect(respostas).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(renovacoes).toBe(1);
    expect(armazenamento.valor).toBe('renovacao-2');
  });

  test('renovação recusada limpa a sessão e avisa o app', async () => {
    const armazenamento = memoria();
    const aoPerderSessao = vi.fn();
    const fetch = vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada);
      if (url.endsWith('/auth/login')) return json(200, sessao(1));
      if (url.endsWith('/auth/renovar')) return json(401, { erro: 'sessao_invalida' });
      return json(401, { erro: 'nao_autenticado', mensagem: 'Faça login' });
    });
    const api = criarCliente({
      baseUrl: 'http://api',
      armazenamento,
      fetch,
      aoPerderSessao,
    });
    await api.entrar('a@b.edu.br', 'senha123');

    await expect(api.get('/eu')).rejects.toMatchObject({ status: 401 });
    expect(aoPerderSessao).toHaveBeenCalledOnce();
    expect(armazenamento.valor).toBeNull();
    expect(api.tokenDeAcesso()).toBeNull();
  });

  test('restaurar usa a renovação guardada; sem ela, não chama a API', async () => {
    const fetch = vi.fn(async () => json(200, sessao(3)));
    const sem = criarCliente({ baseUrl: 'http://api', armazenamento: memoria(), fetch });
    expect(await sem.restaurar()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    const com = criarCliente({
      baseUrl: 'http://api',
      armazenamento: memoria('renovacao-2'),
      fetch,
    });
    expect((await com.restaurar())?.acessoToken).toBe('acesso-3');
    expect(com.tokenDeAcesso()).toBe('acesso-3');
  });

  test('sair avisa a API e esquece os tokens; 204 não tem corpo', async () => {
    const armazenamento = memoria();
    const fetch = vi.fn(async (entrada: RequestInfo | URL) =>
      String(entrada).endsWith('/auth/login')
        ? json(200, sessao(1))
        : new Response(null, { status: 204 }),
    );
    const api = criarCliente({ baseUrl: 'http://api', armazenamento, fetch });
    await api.entrar('a@b.edu.br', 'senha123');
    expect(await api.delete('/matches/1')).toBeUndefined();
    await api.sair();
    expect(fetch).toHaveBeenLastCalledWith(
      'http://api/auth/sair',
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'renovacao-1' }) }),
    );
    expect(armazenamento.valor).toBeNull();
  });
});
