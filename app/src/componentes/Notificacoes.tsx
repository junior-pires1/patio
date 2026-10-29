import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, raio } from '@/tema';

type Notificacao = { id: number; titulo: string; texto?: string; aoTocar?: () => void };
type Mostrar = (n: Omit<Notificacao, 'id'>) => void;

const Contexto = createContext<Mostrar>(() => undefined);

/** Aviso que desce do topo da tela por alguns segundos (curtida, match, mensagem). */
export function ProvedorDeNotificacoes({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState<Notificacao | null>(null);
  const contador = useRef(0);
  const mostrar = useCallback<Mostrar>((n) => {
    contador.current += 1;
    setAtual({ ...n, id: contador.current });
  }, []);

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      {atual ? (
        <Banner key={atual.id} notificacao={atual} aoSumir={() => setAtual(null)} />
      ) : null}
    </Contexto.Provider>
  );
}

export const useNotificar = () => useContext(Contexto);

function Banner({
  notificacao,
  aoSumir,
}: {
  notificacao: Notificacao;
  aoSumir: () => void;
}) {
  const topo = useSafeAreaInsets().top;
  const [posicao] = useState(() => new Animated.Value(-120));

  useEffect(() => {
    const animacao = Animated.sequence([
      Animated.spring(posicao, { toValue: 0, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(posicao, { toValue: -120, duration: 250, useNativeDriver: true }),
    ]);
    animacao.start(({ finished }) => finished && aoSumir());
    return () => animacao.stop();
  }, [posicao, aoSumir]);

  return (
    <Animated.View
      style={[estilos.caixa, { top: topo + 8, transform: [{ translateY: posicao }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPress={() => {
          notificacao.aoTocar?.();
          aoSumir();
        }}
      >
        <Text style={estilos.titulo}>{notificacao.titulo}</Text>
        {notificacao.texto ? <Text style={estilos.texto}>{notificacao.texto}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: cores.texto,
    borderRadius: raio.m,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  titulo: { color: '#fff', fontSize: 15, fontWeight: '700' },
  texto: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 },
});
