import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import type { PessoaResumo, StoriesDaPessoa, Story } from '@/api/tipos';
import { Carregando } from '@/componentes/Estados';
import { VisualizadorStories } from '@/componentes/VisualizadorStories';
import { useSessao } from '@/sessao';
import { alerta } from '@/utils/alerta';

/** Stories de uma pessoa; ao terminar, passa para a próxima da barra. */
export default function VerStories() {
  const { autorId } = useLocalSearchParams<{ autorId: string }>();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const lista = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<StoriesDaPessoa[]>('/stories'),
  });

  const visto = useMutation({
    mutationFn: (story: Story) => api.post(`/stories/${story.id}/visto`),
  });
  const aoVer = useCallback(
    (story: Story) => {
      if (story.visto) return;
      visto.mutate(story);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate é estável
    [],
  );

  const grupos = useMemo(() => lista.data ?? [], [lista.data]);
  const posicao = grupos.findIndex((g) => g.autor.id === autorId);
  const grupo = grupos[posicao];

  const fechar = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['stories'] });
    router.back();
  }, [queryClient]);
  const proximo = useCallback(() => {
    const seguinte = grupos[posicao + 1];
    if (seguinte && !seguinte.meu) {
      router.setParams({ autorId: seguinte.autor.id });
    } else fechar();
  }, [grupos, posicao, fechar]);

  // Os stories da pessoa venceram ou foram apagados: volta.
  const semStories = lista.isSuccess && !grupo;
  useEffect(() => {
    if (semStories) fechar();
  }, [semStories, fechar]);

  if (lista.isPending || !grupo) return <Carregando />;

  const primeiroNaoVisto = Math.max(
    0,
    grupo.stories.findIndex((s) => !s.visto),
  );
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <VisualizadorStories
        key={grupo.autor.id}
        autor={grupo.autor}
        stories={grupo.stories}
        inicio={grupo.meu ? 0 : primeiroNaoVisto}
        meu={grupo.meu}
        aoVer={grupo.meu ? undefined : aoVer}
        aoTerminar={proximo}
        aoFechar={fechar}
        acoesDoAutor={
          grupo.meu
            ? {
                quemViu: (s) =>
                  api.get<{ pessoa: PessoaResumo; vistoEm: string }[]>(
                    `/stories/${s.id}/visualizacoes`,
                  ),
                apagar: (s) =>
                  alerta('Apagar este story?', 'Ele some também dos destaques.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Apagar',
                      style: 'destructive',
                      onPress: () =>
                        void api.delete(`/stories/${s.id}`).then(() => {
                          void queryClient.invalidateQueries({ queryKey: ['destaques'] });
                          fechar();
                        }),
                    },
                  ]),
                paraDestaque: () => router.replace('/destaques/novo'),
              }
            : undefined
        }
      />
    </>
  );
}
