import { Pressable, StyleSheet, Text } from 'react-native';
import { useCorDaFaculdade } from '@/sessao';
import { cores, suave } from '@/tema';

type Props = { texto: string; ativo?: boolean; aoTocar?: () => void };

/** Etiqueta. Com `aoTocar`, vira uma opção que liga e desliga. */
export function Chip({ texto, ativo = false, aoTocar }: Props) {
  const cor = useCorDaFaculdade();
  return (
    <Pressable
      disabled={!aoTocar}
      onPress={aoTocar}
      accessibilityRole={aoTocar ? 'checkbox' : 'text'}
      accessibilityState={aoTocar ? { checked: ativo } : undefined}
      style={[
        estilos.chip,
        ativo
          ? { backgroundColor: cor, borderColor: cor }
          : { backgroundColor: suave(cor), borderColor: 'transparent' },
      ]}
    >
      <Text style={[estilos.texto, { color: ativo ? '#fff' : cores.texto }]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  texto: { fontSize: 14, fontWeight: '500' },
});
