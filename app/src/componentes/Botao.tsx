import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useCorDaFaculdade } from '@/sessao';
import { cores, raio } from '@/tema';

type Props = {
  titulo: string;
  aoTocar: () => void;
  variante?: 'principal' | 'contorno' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
  cor?: string;
};

export function Botao({
  titulo,
  aoTocar,
  variante = 'principal',
  carregando,
  desabilitado,
  cor,
}: Props) {
  const corFaculdade = useCorDaFaculdade();
  const base = variante === 'perigo' ? cores.erro : (cor ?? corFaculdade);
  const cheio = variante !== 'contorno';
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: cheio ? base : 'transparent', borderColor: base },
        (pressed || inativo) && { opacity: 0.6 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={cheio ? '#fff' : base} />
      ) : (
        <Text style={[estilos.texto, { color: cheio ? '#fff' : base }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 50,
    borderRadius: raio.m,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  texto: { fontSize: 16, fontWeight: '700' },
});
