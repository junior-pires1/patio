'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ErroApi } from './cliente';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
);
const CHAVE = 'patio.plataforma.token';

type Admin = { id: string; nome: string; email: string };
type Estado =
  { tipo: 'carregando' } | { tipo: 'anonimo' } | { tipo: 'logado'; admin: Admin };

const ler = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as {
      token: string;
      admin: Admin;
    } | null;
  } catch {
    return null;
  }
};
const gravar = (valor: { token: string; admin: Admin } | null) => {
  try {
    if (valor) localStorage.setItem(CHAVE, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: a sessão dura enquanto a aba estiver aberta
  }
};

type Valor = {
  estado: Estado;
  pedir: <T>(
    metodo: 'GET' | 'POST' | 'PATCH',
    caminho: string,
    corpo?: unknown,
  ) => Promise<T>;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
};

const Contexto = createContext<Valor | null>(null);

/**
 * Sessão da equipe da plataforma. Token próprio de 8 horas (sem renovação),
 * separado da sessão da coordenação.
 */
export function ProvedorPlataforma({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const salvo = ler();
    // Leitura única do armazenamento do navegador ao abrir a página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(salvo?.token ?? null);
    setEstado(salvo ? { tipo: 'logado', admin: salvo.admin } : { tipo: 'anonimo' });
  }, []);

  const valor = useMemo<Valor>(() => {
    async function pedir<T>(
      metodo: 'GET' | 'POST' | 'PATCH',
      caminho: string,
      corpo?: unknown,
      comToken = token,
    ) {
      let resposta: Response;
      try {
        resposta = await fetch(`${API_URL}${caminho}`, {
          method: metodo,
          headers: {
            Accept: 'application/json',
            ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(comToken ? { Authorization: `Bearer ${comToken}` } : {}),
          },
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
      } catch {
        throw new ErroApi(0, 'sem_conexao', 'Não foi possível falar com o servidor.');
      }
      const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
      if (resposta.status === 401 && comToken) {
        gravar(null);
        setToken(null);
        setEstado({ tipo: 'anonimo' });
      }
      if (!resposta.ok) {
        throw new ErroApi(
          resposta.status,
          String(dados.erro ?? 'erro'),
          String(dados.mensagem ?? 'Algo deu errado.'),
          (dados.campos as Record<string, string>) ?? {},
        );
      }
      return dados as T;
    }
    return {
      estado,
      pedir: (metodo, caminho, corpo) => pedir(metodo, caminho, corpo),
      entrar: async (email, senha) => {
        const r = await pedir<{ acessoToken: string; administrador: Admin }>(
          'POST',
          '/plataforma/login',
          { email, senha },
          null,
        );
        gravar({ token: r.acessoToken, admin: r.administrador });
        setToken(r.acessoToken);
        setEstado({ tipo: 'logado', admin: r.administrador });
      },
      sair: () => {
        gravar(null);
        setToken(null);
        setEstado({ tipo: 'anonimo' });
      },
    };
  }, [estado, token]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePlataforma() {
  const v = useContext(Contexto);
  if (!v) throw new Error('usePlataforma precisa estar dentro de ProvedorPlataforma');
  return v;
}
