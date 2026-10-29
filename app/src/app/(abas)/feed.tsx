import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { CategoriaPost, Post } from '@/api/tipos';
import { BlocoAvisos } from '@/componentes/BlocoAvisos';
import { Botao } from '@/componentes/Botao';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao } from '@/sessao';
import { cores, espaco } from '@/tema';
import { CATEGORIAS } from '@/utils/opcoes';

type Pagina = { posts: Post[]; temMais: boolean };

/** RF18/RF21: feed da faculdade com os avisos oficiais no topo. */
export default function Feed() {
  const { api } = useSessao();
  const [filtro, setFiltro] = useState<CategoriaPost | null>(null);

  const feed = useInfiniteQuery({
    queryKey: ['feed', filtro],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams();
      if (filtro) q.set('categoria', filtro);
      if (pageParam) q.set('antes', pageParam);
      return api.get<Pagina>(`/feed?${q.toString()}`);
    },
    getNextPageParam: (ultima) =>
      ultima.temMais ? (ultima.posts.at(-1)?.criadoEm ?? null) : null,
  });

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <BlocoAvisos />
      <Botao titulo="✏️  Publicar" aoTocar={() => router.push('/publicar')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chips}
      >
        <Chip texto="Tudo" ativo={filtro === null} aoTocar={() => setFiltro(null)} />
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            texto={`${c.emoji} ${c.rotulo}`}
            ativo={filtro === c.valor}
            aoTocar={() => setFiltro(c.valor)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={estilos.fundo}
      contentContainerStyle={estilos.lista}
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <CartaoPost post={item} />}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={
        feed.isPending ? (
          <Carregando />
        ) : feed.isError ? (
          <Aviso
            titulo="Não deu para carregar"
            texto={feed.error.message}
            acao={{ titulo: 'Tentar de novo', aoTocar: () => void feed.refetch() }}
          />
        ) : (
          <Aviso titulo="Nada por aqui ainda" texto="Seja a primeira pessoa a publicar." />
        )
      }
      onEndReached={() =>
        feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()
      }
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching}
          onRefresh={() => void feed.refetch()}
        />
      }
    />
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.g, gap: espaco.m },
  cabecalho: { gap: espaco.m },
  chips: { gap: 6 },
});
