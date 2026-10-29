import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cores, estilosBase, raio } from '@/tema';

type Props = TextInputProps & { rotulo: string; erro?: string; ajuda?: string };

/** Campo de texto com rótulo e mensagem de erro logo abaixo. */
export function Campo({ rotulo, erro, ajuda, style, ...props }: Props) {
  return (
    <View>
      <Text style={estilosBase.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor="#9AA3AE"
        accessibilityLabel={rotulo}
        style={[estilos.campo, erro ? estilos.campoComErro : null, style]}
        {...props}
      />
      {erro ? (
        <Text style={estilos.erro}>{erro}</Text>
      ) : ajuda ? (
        <Text style={estilos.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.m,
    backgroundColor: cores.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    color: cores.texto,
  },
  campoComErro: { borderColor: cores.erro },
  erro: { color: cores.erro, fontSize: 13, marginTop: 4 },
  ajuda: { color: cores.textoSuave, fontSize: 13, marginTop: 4 },
});
