import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCorDaFaculdade } from '@/sessao';
import { cores, espaco, estilosBase } from '@/tema';
import { Botao } from './Botao';

export function Carregando() {
  const cor = useCorDaFaculdade();
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={cor} />
    </View>
  );
}

type AvisoProps = {
  titulo: string;
  texto?: string;
  acao?: { titulo: string; aoTocar: () => void };
};

/** Tela vazia ou de erro, com uma ação opcional ("Tentar de novo"). */
export function Aviso({ titulo, texto, acao }: AvisoProps) {
  return (
    <View style={estilos.centro}>
      <Text style={[estilosBase.secao, estilos.textoCentro]}>{titulo}</Text>
      {texto ? (
        <Text style={[estilosBase.subtitulo, estilos.textoCentro]}>{texto}</Text>
      ) : null}
      {acao ? (
        <Botao titulo={acao.titulo} aoTocar={acao.aoTocar} variante="contorno" />
      ) : null}
    </View>
  );
}

export function MensagemDeErro({ texto }: { texto?: string | null }) {
  if (!texto) return null;
  return <Text style={estilos.erro}>{texto}</Text>;
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.m,
    padding: espaco.gg,
  },
  textoCentro: { textAlign: 'center' },
  erro: {
    color: cores.erro,
    backgroundColor: '#FDECEC',
    padding: espaco.m,
    borderRadius: 10,
    fontSize: 14,
  },
});
