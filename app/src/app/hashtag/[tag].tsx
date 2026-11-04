import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import type { Post } from '@/api/tipos';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao } from '@/sessao';
import { espaco, fonte } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

type Pagina = { posts: Post[]; temMais: boolean };

/** Publicações de uma #hashtag. */
export default function TelaHashtag() {
  const s = useEstilos();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { api } = useSessao();
  const lista = useInfiniteQuery({
    queryKey: ['feed', 'hashtag', tag],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<Pagina>(
        `/hashtags/${encodeURIComponent(tag)}/posts${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (u) => (u.temMais ? (u.posts.at(-1)?.criadoEm ?? null) : null),
  });
  const posts = lista.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <FlatList
        style={s.fundo}
        contentContainerStyle={s.lista}
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={s.cabeca}>
            <Text style={s.tag}>#{tag}</Text>
            <Text style={s.conta}>
              {lista.isPending
                ? 'Carregando…'
                : `${posts.length}${lista.hasNextPage ? '+' : ''} ${posts.length === 1 ? 'publicação' : 'publicações'}`}
            </Text>
          </View>
        }
        renderItem={({ item }) => <CartaoPost post={item} />}
        ListEmptyComponent={
          lista.isPending ? (
            <Carregando />
          ) : (
            <Aviso icone="pricetag-outline" titulo="Ninguém usou essa hashtag ainda" />
          )
        }
        onEndReached={() =>
          lista.hasNextPage && !lista.isFetchingNextPage && void lista.fetchNextPage()
        }
      />
    </>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: {
    padding: espaco.g,
    gap: espaco.m,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cabeca: { gap: 2, marginBottom: espaco.p },
  tag: { fontFamily: fonte.extra, fontSize: 28, letterSpacing: -0.6, color: c.marca },
  conta: { fontFamily: fonte.medio, fontSize: 14, color: c.textoSuave },
}));
