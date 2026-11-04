import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { fonte, raio, tipo } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';

type Props = TextInputProps & { rotulo: string; erro?: string; ajuda?: string };

/** Campo de texto com rótulo e mensagem de erro logo abaixo. */
export function Campo({ rotulo, erro, ajuda, style, onFocus, onBlur, ...props }: Props) {
  const { c } = useTema();
  const b = useBase();
  const s = useEstilos();
  const [foco, setFoco] = useState(false);
  return (
    <View>
      <Text style={b.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={c.textoFraco}
        selectionColor={c.marca}
        accessibilityLabel={rotulo}
        onFocus={(e) => {
          setFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          onBlur?.(e);
        }}
        style={[s.campo, foco && s.foco, erro ? s.comErro : null, style]}
        {...props}
      />
      {erro ? (
        <Text style={s.erro}>{erro}</Text>
      ) : ajuda ? (
        <Text style={s.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  campo: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: raio.m,
    backgroundColor: c.superficieAlta,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonte.medio,
    color: c.texto,
  },
  foco: { borderColor: c.marca, backgroundColor: c.superficie },
  comErro: { borderColor: c.erro },
  erro: { ...tipo.apoio, color: c.erro, marginTop: 6 },
  ajuda: { ...tipo.apoio, color: c.textoSuave, marginTop: 6 },
}));
