import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';

export type NomeIcone = keyof typeof Ionicons.glyphMap;

/** Ícone pequeno + texto, no lugar de emojis (data, local, vagas...). */
export function Info({
  icone,
  children,
  cor,
  estilo,
}: {
  icone: NomeIcone;
  children: ReactNode;
  cor?: string;
  estilo?: StyleProp<TextStyle>;
}) {
  const { c } = useTema();
  const tom = cor ?? c.textoSuave;
  return (
    <View style={estilos.linha}>
      <Ionicons name={icone} size={15} color={tom} />
      <Text style={[estilos.texto, { color: tom }, estilo]}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texto: { fontSize: 13.5, fontFamily: fonte.medio, flexShrink: 1 },
});
