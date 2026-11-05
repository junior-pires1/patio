import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';
import { enderecoDaFoto } from '@/utils/endereco';

type Foto = { nome: string; url: string };
type Contexto = { abrir: (foto: Foto) => void; soltar: () => void; fechar: () => void };

const ContextoFoto = createContext<Contexto | null>(null);
const nativo = Platform.OS !== 'web';

/**
 * Foto de perfil ampliada (como no Instagram): segurando a foto, ela aparece
 * grande no meio da tela; soltando, some. Um toque fora também fecha.
 */
export function ProvedorDeFotoAmpliada({ children }: { children: ReactNode }) {
  const { c } = useTema();
  const { width, height } = useWindowDimensions();
  const [foto, setFoto] = useState<Foto | null>(null);
  const [escala] = useState(() => new Animated.Value(0.85));
  const [opacidade] = useState(() => new Animated.Value(0));
  // Quando a foto abriu: no Android, abrir o Modal pode cancelar o toque na hora,
  // e esse "soltar" imediato não pode fechar a foto.
  const abertaEm = useRef(0);

  const fechar = useCallback(() => {
    Animated.timing(opacidade, {
      toValue: 0,
      duration: 120,
      useNativeDriver: nativo,
    }).start(() => setFoto(null));
  }, [opacidade]);

  const abrir = useCallback(
    (nova: Foto) => {
      abertaEm.current = Date.now();
      escala.setValue(0.85);
      opacidade.setValue(0);
      setFoto(nova);
      Animated.parallel([
        Animated.spring(escala, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: nativo,
        }),
        Animated.timing(opacidade, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: nativo,
        }),
      ]).start();
    },
    [escala, opacidade],
  );

  const soltar = useCallback(() => {
    if (Date.now() - abertaEm.current > 250) fechar();
  }, [fechar]);

  // Na web, a foto aberta cobre o dedo/mouse: o "soltar" chega na janela, não no
  // Pressable que abriu. Escuta o soltar na janela enquanto a foto está aberta.
  const aberta = foto !== null;
  useEffect(() => {
    if (!aberta || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const aoSoltar = () => soltar();
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('touchend', aoSoltar);
    return () => {
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('touchend', aoSoltar);
    };
  }, [aberta, soltar]);

  const valor = useMemo(() => ({ abrir, soltar, fechar }), [abrir, soltar, fechar]);
  const lado = Math.min(width - 56, height * 0.55, 380);

  return (
    <ContextoFoto.Provider value={valor}>
      {children}
      <Modal
        visible={foto !== null}
        transparent
        animationType="none"
        onRequestClose={fechar}
        statusBarTranslucent
      >
        <Animated.View
          style={[estilos.fundo, { backgroundColor: c.veu, opacity: opacidade }]}
          onTouchEnd={soltar}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
          />
          {foto ? (
            <Animated.View
              pointerEvents="none"
              style={[estilos.centro, { transform: [{ scale: escala }] }]}
            >
              <Image
                source={{ uri: foto.url }}
                style={{
                  width: lado,
                  height: lado,
                  borderRadius: lado / 2,
                  backgroundColor: c.superficieAlta,
                }}
                accessibilityLabel={`Foto de perfil de ${foto.nome}`}
              />
              <Text style={[estilos.nome, { color: '#FFFFFF' }]}>{foto.nome}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Modal>
    </ContextoFoto.Provider>
  );
}

/**
 * Devolve uma função que gera as props para espalhar num `Pressable` que mostra
 * a foto de alguém: segurar amplia a foto, soltar fecha. Sem foto (só a
 * inicial), não muda nada. Pode ser usada dentro de listas.
 *
 *   const ampliar = useAmpliarFoto();
 *   <Pressable onPress={abrirPerfil} {...ampliar(p.apelido, p.fotoUrl)}>…</Pressable>
 */
export function useAmpliarFoto() {
  const contexto = useContext(ContextoFoto);
  return useCallback(
    (nome: string, fotoUrl?: string | null) => {
      const url = enderecoDaFoto(fotoUrl);
      if (!contexto || !url) return {};
      return {
        delayLongPress: 350,
        onLongPress: () => contexto.abrir({ nome, url }),
        onPressOut: contexto.soltar,
        accessibilityHint: 'Segure para ampliar a foto',
      };
    },
    [contexto],
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', gap: 14 },
  nome: { fontFamily: fonte.negrito, fontSize: 17 },
});
