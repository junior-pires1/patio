import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';
import { espaco, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { Botao } from './Botao';
import type { NomeIcone } from './Info';

export function Carregando() {
  const { c } = useTema();
  const s = useEstilos();
  return (
    <View style={s.centro}>
      <ActivityIndicator size="large" color={c.marca} />
    </View>
  );
}

type AvisoProps = {
  titulo: string;
  texto?: string;
  icone?: NomeIcone;
  acao?: { titulo: string; aoTocar: () => void };
};

/** Tela vazia ou de erro, com ícone e uma ação opcional ("Tentar de novo"). */
export function Aviso({ titulo, texto, icone = 'sparkles-outline', acao }: AvisoProps) {
  const { c } = useTema();
  const s = useEstilos();
  return (
    <View style={s.centro}>
      <View style={s.selo}>
        <Ionicons name={icone} size={28} color={c.marca} />
      </View>
      <Text style={s.titulo}>{titulo}</Text>
      {texto ? <Text style={s.texto}>{texto}</Text> : null}
      {acao ? (
        <View style={s.acao}>
          <Botao titulo={acao.titulo} aoTocar={acao.aoTocar} variante="suave" compacto />
        </View>
      ) : null}
    </View>
  );
}

export function MensagemDeErro({ texto }: { texto?: string | null }) {
  const { c } = useTema();
  const s = useEstilos();
  if (!texto) return null;
  return (
    <View style={s.erro} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={c.erro} />
      <Text style={s.textoErro}>{texto}</Text>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.p,
    padding: espaco.ggg,
  },
  selo: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: c.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.p,
  },
  titulo: { ...tipo.secao, color: c.texto, textAlign: 'center' },
  texto: { ...tipo.corpo, color: c.textoSuave, textAlign: 'center', maxWidth: 320 },
  acao: { marginTop: espaco.m },
  erro: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: c.erroSuave,
    padding: espaco.m,
    borderRadius: raio.m,
  },
  textoErro: { ...tipo.apoio, color: c.erro, flex: 1, fontSize: 14, lineHeight: 20 },
}));
