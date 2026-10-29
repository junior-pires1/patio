'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { criarCliente, ErroApi, type Armazenamento, type Cliente } from './cliente';
import type { Usuario } from './tipos';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
);
const CHAVE = 'patio.painel.renovacao';

const armazenamento: Armazenamento = {
  ler: async () => {
    try {
      return localStorage.getItem(CHAVE);
    } catch {
      return null;
    }
  },
  gravar: async (valor) => {
    try {
      if (valor) localStorage.setItem(CHAVE, valor);
      else localStorage.removeItem(CHAVE);
    } catch {
      // navegador sem armazenamento: a sessão dura só enquanto a aba estiver aberta
    }
  },
};

type Estado =
  { tipo: 'carregando' } | { tipo: 'anonimo' } | { tipo: 'logado'; usuario: Usuario };

type ValorSessao = {
  estado: Estado;
  api: Cliente;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<ValorSessao | null>(null);

const SO_COORDENACAO = new ErroApi(
  403,
  'sem_permissao',
  'Este painel é da coordenação. Alunos usam o aplicativo do Pátio.',
);

export function Provedores({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }),
  );
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const api = useMemo(
    () =>
      criarCliente({
        baseUrl: API_URL,
        armazenamento,
        aoPerderSessao: () => setEstado({ tipo: 'anonimo' }),
      }),
    [],
  );

  useEffect(() => {
    api
      .restaurar()
      .then((s) =>
        setEstado(
          s && s.usuario.papel === 'COORDENACAO'
            ? { tipo: 'logado', usuario: s.usuario }
            : { tipo: 'anonimo' },
        ),
      )
      .catch(() => setEstado({ tipo: 'anonimo' }));
  }, [api]);

  const valor = useMemo<ValorSessao>(
    () => ({
      estado,
      api,
      entrar: async (email, senha) => {
        const sessao = await api.entrar(email, senha);
        if (sessao.usuario.papel !== 'COORDENACAO') {
          await api.sair();
          throw SO_COORDENACAO;
        }
        setEstado({ tipo: 'logado', usuario: sessao.usuario });
      },
      sair: async () => {
        await api.sair();
        queryClient.clear();
        setEstado({ tipo: 'anonimo' });
      },
    }),
    [estado, api, queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Contexto.Provider value={valor}>{children}</Contexto.Provider>
    </QueryClientProvider>
  );
}

export function useSessao() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSessao precisa estar dentro de Provedores');
  return valor;
}

export function useUsuario(): Usuario {
  const { estado } = useSessao();
  if (estado.tipo !== 'logado') throw new Error('Nenhum usuário logado');
  return estado.usuario;
}
