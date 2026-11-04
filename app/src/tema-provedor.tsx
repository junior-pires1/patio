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
import {
  Platform,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { base, paletas, type Cores, type Esquema } from './tema';

/** "sistema" segue o celular/computador; claro e escuro fixam o tema. */
export type Preferencia = 'sistema' | Esquema;

const CHAVE = 'patio.tema';

const guardar = {
  ler: async (): Promise<string | null> =>
    Platform.OS === 'web'
      ? (globalThis.localStorage?.getItem(CHAVE) ?? null)
      : SecureStore.getItemAsync(CHAVE),
  gravar: async (v: string) =>
    Platform.OS === 'web'
      ? globalThis.localStorage?.setItem(CHAVE, v)
      : SecureStore.setItemAsync(CHAVE, v),
};

type ValorTema = {
  esquema: Esquema;
  c: Cores;
  preferencia: Preferencia;
  definirPreferencia: (p: Preferencia) => void;
};

const Contexto = createContext<ValorTema>({
  esquema: 'claro',
  c: paletas.claro,
  preferencia: 'sistema',
  definirPreferencia: () => undefined,
});

export function ProvedorDeTema({ children }: { children: ReactNode }) {
  const doSistema = useColorScheme() === 'dark' ? 'escuro' : 'claro';
  const [preferencia, setPreferencia] = useState<Preferencia>('sistema');

  useEffect(() => {
    guardar
      .ler()
      .then((v) => {
        if (v === 'claro' || v === 'escuro' || v === 'sistema') setPreferencia(v);
      })
      .catch(() => undefined);
  }, []);

  const definirPreferencia = useCallback((p: Preferencia) => {
    setPreferencia(p);
    guardar.gravar(p).catch(() => undefined);
  }, []);

  const esquema: Esquema = preferencia === 'sistema' ? doSistema : preferencia;

  // Na web, o fundo da página e as barras de rolagem acompanham o tema.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const raiz = document.documentElement;
    // Os campos já mostram o foco com a borda azul; o contorno do navegador sobra.
    if (!document.getElementById('patio-foco')) {
      const css = document.createElement('style');
      css.id = 'patio-foco';
      css.textContent = 'input:focus, textarea:focus { outline: none; }';
      document.head.appendChild(css);
    }
    raiz.style.colorScheme = esquema === 'escuro' ? 'dark' : 'light';
    raiz.style.backgroundColor = paletas[esquema].fundo;
    document.body.style.backgroundColor = paletas[esquema].fundo;
  }, [esquema]);

  const valor = useMemo(
    () => ({ esquema, c: paletas[esquema], preferencia, definirPreferencia }),
    [esquema, preferencia, definirPreferencia],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useTema = () => useContext(Contexto);

const bases: Partial<Record<Esquema, ReturnType<typeof base>>> = {};

/** Estilos comuns (título, rótulo, cartão...) do tema atual. */
export function useBase() {
  const { esquema, c } = useTema();
  return (bases[esquema] ??= base(c));
}

/**
 * Cria um hook de estilos que muda com o tema. Uso:
 *   const useEstilos = criarEstilos((c) => ({ caixa: { backgroundColor: c.superficie } }));
 *   const s = useEstilos();
 */
export function criarEstilos<T extends Record<keyof T, ViewStyle | TextStyle | ImageStyle>>(
  fazer: (c: Cores) => T,
) {
  const cache: Partial<Record<Esquema, T>> = {};
  return function useEstilos(): T {
    const { esquema, c } = useTema();
    return (cache[esquema] ??= StyleSheet.create(fazer(c)));
  };
}
