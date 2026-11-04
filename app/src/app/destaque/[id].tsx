import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Destaque, PessoaResumo } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { VisualizadorStories } from '@/componentes/VisualizadorStories';
import { useSessao } from '@/sessao';
import { alerta } from '@/utils/alerta';
import { voltar } from '@/utils/navegacao';

/** Abre um destaque do perfil (stories guardados). */
export default function VerDestaque() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const destaque = useQuery({
    queryKey: ['destaque', id],
    queryFn: () => api.get<Destaque>(`/destaques/${id}`),
  });
  const fechar = useCallback(() => voltar('/perfil'), []);

  if (destaque.isPending) return <Carregando />;
  if (destaque.isError || destaque.data.stories.length === 0) {
    return (
      <SafeAreaView style={estilos.fundo}>
        <Aviso
          titulo="Destaque indisponível"
          texto={destaque.error?.message}
          acao={{ titulo: 'Voltar', aoTocar: fechar }}
        />
      </SafeAreaView>
    );
  }
  const d = destaque.data;

  function apagarDestaque() {
    alerta('Apagar o destaque?', 'Os stories continuam no seu arquivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          void api.delete(`/destaques/${d.id}`).then(() => {
            void queryClient.invalidateQueries({ queryKey: ['destaques'] });
            fechar();
          }),
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <VisualizadorStories
        autor={d.autor}
        stories={d.stories}
        meu={d.meu}
        titulo={d.titulo}
        aoTerminar={fechar}
        aoFechar={fechar}
        acoesDoAutor={
          d.meu
            ? {
                quemViu: (s) =>
                  api.get<{ pessoa: PessoaResumo; vistoEm: string }[]>(
                    `/stories/${s.id}/visualizacoes`,
                  ),
                apagar: apagarDestaque,
              }
            : undefined
        }
      />
      {d.meu ? (
        <Pressable
          onPress={() =>
            router.replace({ pathname: '/destaques/novo', params: { id: d.id } })
          }
          style={estilos.editar}
          accessibilityRole="button"
        >
          <Text style={estilos.editarTexto}>Editar destaque</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1 },
  editar: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editarTexto: { color: '#fff', fontWeight: '600' },
});
