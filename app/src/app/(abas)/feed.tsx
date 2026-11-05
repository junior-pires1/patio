import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { CategoriaPost, Post } from '@/api/tipos';
import { BarraStories } from '@/componentes/BarraStories';
import { BlocoAvisos } from '@/componentes/BlocoAvisos';
import { Avatar } from '@/componentes/Avatar';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { CATEGORIAS } from '@/utils/opcoes';

type Pagina = { posts: Post[]; temMais: boolean };

/** RF18/RF21: feed da faculdade com os avisos oficiais no topo. */
export default function Feed() {
  const estilos = useEstilos();
  const { c } = useTema();
  const { api } = useSessao();
  const eu = useUsuario();
  // "SEGUINDO" mostra só quem a pessoa segue; as outras são categorias.
  const [filtro, setFiltro] = useState<CategoriaPost | 'SEGUINDO' | null>(null);

  const feed = useInfiniteQuery({
    queryKey: ['feed', filtro],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams();
      if (filtro === 'SEGUINDO') q.set('aba', 'seguindo');
      else if (filtro) q.set('categoria', filtro);
      if (pageParam) q.set('antes', pageParam);
      return api.get<Pagina>(`/feed?${q.toString()}`);
    },
    getNextPageParam: (ultima) =>
      ultima.temMais ? (ultima.posts.at(-1)?.criadoEm ?? null) : null,
  });

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <BarraStories />
      <BlocoAvisos />
      <Pressable
        onPress={() => router.push('/publicar')}
        accessibilityRole="button"
        accessibilityLabel="Publicar"
        style={({ pressed }) => [estilos.composer, pressed && { opacity: 0.85 }]}
      >
        <Avatar nome={eu.apelido} fotoUrl={eu.fotoUrl} tamanho={38} />
        <Text style={estilos.composerTexto} numberOfLines={1}>
          Compartilhe algo com a turma…
        </Text>
        <View style={estilos.composerIcone}>
          <Ionicons name="image-outline" size={18} color={c.marca} />
        </View>
        <View style={[estilos.composerIcone, estilos.composerEnviar]}>
          <Ionicons name="add" size={20} color={c.sobreMarca} />
        </View>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chips}
      >
        <Chip texto="Tudo" ativo={filtro === null} aoTocar={() => setFiltro(null)} />
        <Chip
          texto="Seguindo"
          ativo={filtro === 'SEGUINDO'}
          aoTocar={() => setFiltro('SEGUINDO')}
        />
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            texto={c.rotulo}
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
          <Aviso
            icone="newspaper-outline"
            titulo="Nada por aqui ainda"
            texto={
              filtro === 'SEGUINDO'
                ? 'Siga colegas pelo perfil deles para ver as publicações aqui.'
                : 'Seja a primeira pessoa a publicar.'
            }
          />
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

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: {
    padding: espaco.g,
    paddingTop: espaco.p,
    gap: espaco.m,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: 10,
    paddingLeft: 10,
    borderRadius: raio.g,
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
  },
  composerTexto: { flex: 1, fontFamily: fonte.medio, fontSize: 15, color: c.textoFraco },
  composerIcone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: c.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerEnviar: { backgroundColor: c.marca },
  cabecalho: { gap: espaco.m },
  chips: { gap: 6 },
}));
