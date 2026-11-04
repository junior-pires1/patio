import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import type { NomeIcone } from './Info';

type Props = {
  titulo: string;
  aoTocar: () => void;
  /** principal = ação da tela; suave = ação secundária; contorno = discreta; perigo = destrutiva. */
  variante?: 'principal' | 'suave' | 'contorno' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
  /** Troca a cor da variante principal (ex.: cor da faculdade no cadastro). */
  cor?: string;
  icone?: NomeIcone;
  compacto?: boolean;
};

export function Botao({
  titulo,
  aoTocar,
  variante = 'principal',
  carregando,
  desabilitado,
  cor,
  icone,
  compacto,
}: Props) {
  const { c } = useTema();
  const s = useEstilos();
  const inativo = desabilitado || carregando;
  const [fundo, frente, borda] =
    variante === 'principal'
      ? [cor ?? c.marca, c.sobreMarca, 'transparent']
      : variante === 'suave'
        ? [c.marcaSuave, c.marca, 'transparent']
        : variante === 'perigo'
          ? [c.erroSuave, c.erro, 'transparent']
          : ['transparent', c.texto, c.borda];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={aoTocar}
      style={({ pressed }) => [
        s.botao,
        compacto && s.compacto,
        { backgroundColor: fundo, borderColor: borda },
        pressed && s.pressionado,
        inativo && s.inativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={frente} />
      ) : (
        <View style={s.conteudo}>
          {icone ? (
            <Ionicons name={icone} size={compacto ? 16 : 18} color={frente} />
          ) : null}
          <Text style={[s.texto, compacto && s.textoCompacto, { color: frente }]}>
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const useEstilos = criarEstilos(() => ({
  botao: {
    minHeight: 52,
    borderRadius: raio.m,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  compacto: { minHeight: 40, paddingHorizontal: 14, borderRadius: raio.p + 2 },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  inativo: { opacity: 0.5 },
  texto: { fontFamily: fonte.negrito, fontSize: 16, letterSpacing: -0.1 },
  textoCompacto: { fontSize: 14 },
}));
