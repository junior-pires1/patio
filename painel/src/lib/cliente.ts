// Mesmo cliente do aplicativo (app/src/api/cliente.ts). Ao mudar um, mude o outro.
import type { Sessao } from './tipos';

/** Erro devolvido pela API, no formato `{ erro, mensagem, campos? }`. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campos: Record<string, string> = {},
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

/** Onde o token de renovação fica guardado (localStorage no painel). */
export type Armazenamento = {
  ler(): Promise<string | null>;
  gravar(valor: string | null): Promise<void>;
};

type Opcoes = {
  baseUrl: string;
  armazenamento: Armazenamento;
  /** Chamado quando a sessão não pode mais ser renovada (volta ao login). */
  aoPerderSessao?: () => void;
  fetch?: typeof fetch;
};

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const ERRO_DE_REDE = new ErroApi(
  0,
  'sem_conexao',
  'Não foi possível falar com o servidor. Confira a internet e o endereço da API.',
);

/**
 * Cliente HTTP da API. Guarda o token de acesso em memória e, quando ele
 * vence (401), troca o token de renovação por um novo par uma única vez,
 * mesmo que várias requisições falhem ao mesmo tempo.
 */
export function criarCliente(opcoes: Opcoes) {
  const buscar = opcoes.fetch ?? fetch;
  let acesso: string | null = null;
  let renovando: Promise<boolean> | null = null;

  async function chamar(metodo: Metodo, caminho: string, corpo?: unknown) {
    const cabecalhos: Record<string, string> = { Accept: 'application/json' };
    if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
    if (acesso) cabecalhos.Authorization = `Bearer ${acesso}`;
    try {
      return await buscar(`${opcoes.baseUrl}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw ERRO_DE_REDE;
    }
  }

  async function lerResposta<T>(resposta: Response): Promise<T> {
    if (resposta.status === 204) return undefined as T;
    const dados: unknown = await resposta.json().catch(() => null);
    if (resposta.ok) return dados as T;
    const erro = (dados ?? {}) as {
      erro?: string;
      mensagem?: string;
      campos?: Record<string, string>;
    };
    throw new ErroApi(
      resposta.status,
      erro.erro ?? 'erro_desconhecido',
      erro.mensagem ?? 'Algo deu errado. Tente novamente.',
      erro.campos,
    );
  }

  async function guardarSessao(sessao: Sessao) {
    acesso = sessao.acessoToken;
    await opcoes.armazenamento.gravar(sessao.refreshToken);
  }

  async function limparSessao() {
    acesso = null;
    await opcoes.armazenamento.gravar(null);
  }

  /** Troca o token de renovação guardado por um novo par. */
  async function renovar(): Promise<Sessao | null> {
    const refreshToken = await opcoes.armazenamento.ler();
    if (!refreshToken) return null;
    const resposta = await chamar('POST', '/auth/renovar', { refreshToken });
    if (!resposta.ok) {
      await limparSessao();
      return null;
    }
    const sessao = await lerResposta<Sessao>(resposta);
    await guardarSessao(sessao);
    return sessao;
  }

  function renovarUmaVez(): Promise<boolean> {
    renovando ??= renovar()
      .then((s) => s !== null)
      .finally(() => {
        renovando = null;
      });
    return renovando;
  }

  async function requisitar<T>(
    metodo: Metodo,
    caminho: string,
    corpo?: unknown,
  ): Promise<T> {
    let resposta = await chamar(metodo, caminho, corpo);
    if (resposta.status === 401 && acesso !== null) {
      if (await renovarUmaVez()) {
        resposta = await chamar(metodo, caminho, corpo);
      } else {
        opcoes.aoPerderSessao?.();
      }
    }
    return lerResposta<T>(resposta);
  }

  return {
    get: <T>(caminho: string) => requisitar<T>('GET', caminho),
    post: <T>(caminho: string, corpo?: unknown) =>
      requisitar<T>('POST', caminho, corpo ?? {}),
    patch: <T>(caminho: string, corpo: unknown) => requisitar<T>('PATCH', caminho, corpo),
    put: <T>(caminho: string, corpo: unknown) => requisitar<T>('PUT', caminho, corpo),
    delete: (caminho: string) => requisitar<void>('DELETE', caminho),

    /** Token atual, para o Socket.IO. */
    tokenDeAcesso: () => acesso,

    /** Ao abrir o app: tenta voltar à sessão guardada. */
    restaurar: renovar,

    async entrar(email: string, senha: string): Promise<Sessao> {
      const sessao = await requisitar<Sessao>('POST', '/auth/login', { email, senha });
      await guardarSessao(sessao);
      return sessao;
    },

    async cadastrar(dados: Record<string, unknown>): Promise<Sessao> {
      const sessao = await requisitar<Sessao>('POST', '/auth/cadastro', dados);
      await guardarSessao(sessao);
      return sessao;
    },

    async sair(): Promise<void> {
      const refreshToken = await opcoes.armazenamento.ler();
      if (refreshToken) {
        await chamar('POST', '/auth/sair', { refreshToken }).catch(() => undefined);
      }
      await limparSessao();
    },
  };
}

export type Cliente = ReturnType<typeof criarCliente>;
