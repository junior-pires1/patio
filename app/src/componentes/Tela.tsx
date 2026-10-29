import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cores, espaco } from '@/tema';

type Props = { children: ReactNode; rolagem?: boolean; semTopo?: boolean };

/** Área segura + teclado + rolagem opcional, com o fundo padrão. */
export function Tela({ children, rolagem = false, semTopo = false }: Props) {
  return (
    <SafeAreaView style={estilos.fundo} edges={semTopo ? ['left', 'right'] : undefined}>
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {rolagem ? (
          <ScrollView
            contentContainerStyle={estilos.conteudo}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[estilos.fundo, estilos.conteudo]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.g, gap: espaco.m, flexGrow: 1 },
});
