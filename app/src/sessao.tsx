import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { criarCliente, type Armazenamento, type Cliente } from './api/cliente';
import type { MeuPerfil, Sessao } from './api/tipos';
import { API_URL } from './config';
import { tokenRegistrado } from './push';
import { cores } from './tema';

const CHAVE = 'patio.renovacao';

// No celular o token fica no cofre do sistema (Keychain / Keystore).
const armazenamento: Armazenamento =
  Platform.OS === 'web'
    ? {
        ler: async () => globalThis.localStorage?.getItem(CHAVE) ?? null,
        gravar: async (v) =>
          v
            ? globalThis.localStorage?.setItem(CHAVE, v)
            : globalThis.localStorage?.removeItem(CHAVE),
      }
    : {
        ler: () => SecureStore.getItemAsync(CHAVE),
        gravar: (v) =>
          v ? SecureStore.setItemAsync(CHAVE, v) : SecureStore.deleteItemAsync(CHAVE),
      };

type Estado =
  { tipo: 'carregando' } | { tipo: 'anonimo' } | { tipo: 'logado'; usuario: MeuPerfil };

type ValorSessao = {
  estado: Estado;
  api: Cliente;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: Record<string, unknown>) => Promise<void>;
  /** Para fluxos que já devolvem uma sessão (ex.: redefinir a senha). */
  entrarComSessao: (sessao: Sessao) => void;
  sair: () => Promise<void>;
  atualizarUsuario: (usuario: MeuPerfil) => void;
};

const Contexto = createContext<ValorSessao | null>(null);

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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

  // Ao abrir o app, volta para a sessão guardada (se houver).
  useEffect(() => {
    api
      .restaurar()
      .then((s) =>
        setEstado(s ? { tipo: 'logado', usuario: s.usuario } : { tipo: 'anonimo' }),
      )
      .catch(() => setEstado({ tipo: 'anonimo' }));
  }, [api]);

  const aoEntrar = useCallback((s: Sessao) => {
    setEstado({ tipo: 'logado', usuario: s.usuario });
  }, []);

  const valor = useMemo<ValorSessao>(
    () => ({
      estado,
      api,
      entrar: async (email, senha) => aoEntrar(await api.entrar(email, senha)),
      cadastrar: async (dados) => aoEntrar(await api.cadastrar(dados)),
      entrarComSessao: aoEntrar,
      sair: async () => {
        // Este aparelho deixa de receber notificações desta conta.
        const token = tokenRegistrado();
        if (token) await api.delete('/eu/push', { token }).catch(() => undefined);
        await api.sair();
        queryClient.clear();
        setEstado({ tipo: 'anonimo' });
      },
      atualizarUsuario: (usuario) => setEstado({ tipo: 'logado', usuario }),
    }),
    [estado, api, aoEntrar, queryClient],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao');
  return valor;
}

/** Usuário logado (use só em telas protegidas). */
export function useUsuario(): MeuPerfil {
  const { estado } = useSessao();
  if (estado.tipo !== 'logado') throw new Error('Nenhum usuário logado');
  return estado.usuario;
}

/** Cor da faculdade de quem está logado (ou a cor padrão). */
export function useCorDaFaculdade(): string {
  const { estado } = useSessao();
  return estado.tipo === 'logado' ? estado.usuario.instituicao.corPrimaria : cores.padrao;
}
