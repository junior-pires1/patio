import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { cores } from '@/tema';

export type NomeIcone = keyof typeof Ionicons.glyphMap;

/** Ícone pequeno + texto, no lugar de emojis (data, local, vagas...). */
export function Info({
  icone,
  children,
  cor = cores.textoSuave,
  estilo,
}: {
  icone: NomeIcone;
  children: ReactNode;
  cor?: string;
  estilo?: StyleProp<TextStyle>;
}) {
  return (
    <View style={estilos.linha}>
      <Ionicons name={icone} size={15} color={cor} />
      <Text style={[estilos.texto, { color: cor }, estilo]}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texto: { fontSize: 14, flexShrink: 1 },
});
