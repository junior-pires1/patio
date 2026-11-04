import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CurtidaFeita, CurtidaRecebida, Post } from '@/api/tipos';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Chip } from '@/componentes/Chip';
import { Carregando } from '@/componentes/Estados';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { useNotificar } from '@/componentes/Notificacoes';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, estilosBase, raio } from '@/tema';
import { alerta } from '@/utils/alerta';
import { quando } from '@/utils/datas';

type Aba = 'feitas' | 'recebidas' | 'posts';

/**
 * Histórico de curtidas: em quem você curtiu (dá para desfazer e curtir de
 * novo), quem curtiu você (curtir de volta vira conexão) e publicações curtidas.
 */
export default function Atividade() {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const [aba, setAba] = useState<Aba>('feitas');
  // Descurtidas nesta tela continuam na lista para poder curtir de novo.
  const [desfeitas, setDesfeitas] = useState<Set<string>>(new Set());

  const feitas = useQuery({
    queryKey: ['atividade', 'feitas'],
    queryFn: () => api.get<CurtidaFeita[]>('/eu/curtidas'),
  });
  const recebidas = useQuery({
    queryKey: ['atividade', 'recebidas'],
    queryFn: () => api.get<CurtidaRecebida[]>('/eu/curtidas/recebidas'),
  });
  const posts = useInfiniteQuery({
    queryKey: ['atividade', 'posts'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<{ posts: Post[]; temMais: boolean }>(
        `/eu/posts-curtidos${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (u) => (u.temMais ? (u.posts.at(-1)?.criadoEm ?? null) : null),
    enabled: aba === 'posts',
  });

  const atualizarTudo = () => {
    void queryClient.invalidateQueries({ queryKey: ['descobrir'] });
    void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
    void queryClient.invalidateQueries({ queryKey: ['perfil'] });
  };

  const curtir = useMutation({
    mutationFn: (id: string) =>
      api.post<{ match: { id: string } | null }>('/curtidas', { paraId: id }),
    onSuccess: (r, id) => {
      setDesfeitas((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      atualizarTudo();
      void queryClient.invalidateQueries({ queryKey: ['atividade'] });
      if (r.match) {
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
        notificar({ titulo: 'Nova conexão!', texto: 'Agora vocês podem conversar.' });
      }
    },
    onError: (e) => alerta('Não foi possível curtir', e.message),
  });
  const descurtir = useMutation({
    mutationFn: (id: string) => api.delete(`/curtidas/${id}`),
    onSuccess: (_r, id) => {
      setDesfeitas((s) => new Set(s).add(id));
      atualizarTudo();
    },
    onError: (e) => alerta('Não foi possível desfazer', e.message),
  });

  const botao = (titulo: string, aoTocar: () => void, cheio: boolean) => (
    <Pressable
      onPress={aoTocar}
      disabled={curtir.isPending || descurtir.isPending}
      style={[
        estilos.botao,
        cheio ? { backgroundColor: cor, borderColor: cor } : { borderColor: cores.borda },
      ]}
      accessibilityRole="button"
    >
      <Text style={[estilos.botaoTexto, { color: cheio ? '#fff' : cores.texto }]}>
        {titulo}
      </Text>
    </Pressable>
  );

  const abas = (
    <View style={estilos.abas}>
      {(
        [
          ['feitas', 'Você curtiu'],
          ['recebidas', 'Curtiram você'],
          ['posts', 'Publicações'],
        ] as const
      ).map(([valor, rotulo]) => (
        <Chip
          key={valor}
          texto={rotulo}
          ativo={aba === valor}
          aoTocar={() => setAba(valor)}
        />
      ))}
    </View>
  );

  if (aba === 'posts') {
    const lista = posts.data?.pages.flatMap((p) => p.posts) ?? [];
    return (
      <FlatList
        style={estilos.fundo}
        contentContainerStyle={estilos.lista}
        data={lista}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={abas}
        renderItem={({ item }) => <CartaoPost post={item} />}
        ListEmptyComponent={
          posts.isPending ? (
            <Carregando />
          ) : (
            <Text style={estilosBase.subtitulo}>Você ainda não curtiu publicações.</Text>
          )
        }
        onEndReached={() =>
          posts.hasNextPage && !posts.isFetchingNextPage && void posts.fetchNextPage()
        }
      />
    );
  }

  if (aba === 'recebidas') {
    return (
      <FlatList
        style={estilos.fundo}
        contentContainerStyle={estilos.lista}
        data={recebidas.data ?? []}
        keyExtractor={(c) => c.pessoa.id}
        ListHeaderComponent={abas}
        ListEmptyComponent={
          recebidas.isPending ? (
            <Carregando />
          ) : (
            <Text style={estilosBase.subtitulo}>
              Ninguém esperando resposta agora. Quando alguém curtir você, aparece aqui.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={estilos.cartao}>
            <LinhaPessoa
              pessoa={item.pessoa}
              detalhe={`Curtiu você ${quando(item.curtidoEm)}`}
              acao={botao('Curtir de volta', () => curtir.mutate(item.pessoa.id), true)}
            />
          </View>
        )}
      />
    );
  }

  return (
    <FlatList
      style={estilos.fundo}
      contentContainerStyle={estilos.lista}
      data={feitas.data ?? []}
      keyExtractor={(c) => c.pessoa.id}
      ListHeaderComponent={abas}
      ListEmptyComponent={
        feitas.isPending ? (
          <Carregando />
        ) : (
          <Text style={estilosBase.subtitulo}>Você ainda não curtiu ninguém.</Text>
        )
      }
      renderItem={({ item }) => {
        const desfeita = desfeitas.has(item.pessoa.id);
        return (
          <View style={estilos.cartao}>
            <LinhaPessoa
              pessoa={item.pessoa}
              detalhe={
                item.conexao
                  ? 'Conexão'
                  : desfeita
                    ? 'Curtida desfeita'
                    : `Você curtiu ${quando(item.curtidoEm)}`
              }
              acao={
                item.conexao
                  ? null
                  : desfeita
                    ? botao('Curtir de novo', () => curtir.mutate(item.pessoa.id), true)
                    : botao('Descurtir', () => descurtir.mutate(item.pessoa.id), false)
              }
            />
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.g, gap: espaco.p },
  abas: { flexDirection: 'row', gap: 6, marginBottom: espaco.p },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingHorizontal: espaco.m,
  },
  botao: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  botaoTexto: { fontSize: 13, fontWeight: '700' },
});
