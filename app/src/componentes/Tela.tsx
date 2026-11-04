import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { espaco } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

type Props = { children: ReactNode; rolagem?: boolean; semTopo?: boolean };

/** Área segura + teclado + rolagem opcional, com o fundo do tema. Largura máxima na web. */
export function Tela({ children, rolagem = false, semTopo = false }: Props) {
  const estilos = useEstilos();
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

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    padding: espaco.g,
    gap: espaco.m,
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
}));
