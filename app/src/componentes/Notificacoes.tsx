import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevacao, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';

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
  const { c } = useTema();
  const estilos = useEstilos();
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
        style={estilos.linha}
        onPress={() => {
          notificacao.aoTocar?.();
          aoSumir();
        }}
      >
        <View style={estilos.icone}>
          <Ionicons name="notifications" size={18} color={c.sobreDestaque} />
        </View>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>{notificacao.titulo}</Text>
          {notificacao.texto ? (
            <Text style={estilos.texto} numberOfLines={2}>
              {notificacao.texto}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useEstilos = criarEstilos((c) => ({
  caixa: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: c.invertido,
    borderRadius: raio.g,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...elevacao(c, 2),
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1 },
  titulo: { color: c.sobreInvertido, fontSize: 15, fontFamily: fonte.negrito },
  texto: {
    color: c.sobreInvertido,
    opacity: 0.78,
    fontSize: 13.5,
    fontFamily: fonte.medio,
    marginTop: 1,
  },
}));
