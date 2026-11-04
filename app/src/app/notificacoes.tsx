import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import type { Notificacao, TipoNotificacao } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import type { NomeIcone } from '@/componentes/Info';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';
import { enderecoDaFoto } from '@/utils/endereco';

type Pagina = { notificacoes: Notificacao[]; temMais: boolean };

// Selo no canto do avatar, como no Instagram.
const SELOS: Record<
  TipoNotificacao,
  { icone: NomeIcone; cor: 'erro' | 'marca' | 'destaque' | 'sucesso' }
> = {
  POST_CURTIDO: { icone: 'heart', cor: 'erro' },
  COMENTARIO_CURTIDO: { icone: 'heart', cor: 'erro' },
  POST_COMENTADO: { icone: 'chatbubble', cor: 'marca' },
  COMENTARIO_RESPONDIDO: { icone: 'arrow-undo', cor: 'marca' },
  MENCAO: { icone: 'at', cor: 'marca' },
  CONEXAO_NOVA: { icone: 'sparkles', cor: 'destaque' },
  RECOMENDACAO: { icone: 'ribbon', cor: 'sucesso' },
};

/** Central de notificações: curtidas, comentários, respostas, menções e conexões. */
export default function Notificacoes() {
  const s = useEstilos();
  const { c, esquema } = useTema();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const lista = useInfiniteQuery({
    queryKey: ['notificacoes'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<Pagina>(
        `/notificacoes${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (u) => (u.temMais ? (u.notificacoes.at(-1)?.criadoEm ?? null) : null),
  });
  const marcar = useMutation({
    mutationFn: () => api.post('/notificacoes/lidas', {}),
    onSuccess: () => queryClient.setQueryData(['notificacoes-nao-lidas'], { total: 0 }),
  });
  // Abrir a tela marca tudo como lido (as novas ficam destacadas até sair).
  useFocusEffect(
    useCallback(() => {
      marcar.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const itens = lista.data?.pages.flatMap((p) => p.notificacoes) ?? [];
  const cor = { erro: c.erro, marca: c.marca, destaque: c.destaque, sucesso: c.sucesso };

  function abrir(n: Notificacao) {
    if (n.tipo === 'CONEXAO_NOVA' && n.matchId)
      router.push({ pathname: '/chat/[id]', params: { id: n.matchId } });
    else if (n.post) router.push({ pathname: '/post/[id]', params: { id: n.post.id } });
    else if (n.ator) router.push({ pathname: '/usuario/[id]', params: { id: n.ator.id } });
  }

  if (lista.isPending) return <Carregando />;
  if (lista.isError)
    return (
      <Aviso
        titulo="Não deu para carregar"
        texto={lista.error.message}
        acao={{ titulo: 'Tentar de novo', aoTocar: () => void lista.refetch() }}
      />
    );

  return (
    <FlatList
      style={s.fundo}
      contentContainerStyle={[s.lista, itens.length === 0 && s.vazia]}
      data={itens}
      keyExtractor={(n) => n.id}
      refreshControl={
        <RefreshControl
          refreshing={lista.isRefetching}
          onRefresh={() => void lista.refetch()}
        />
      }
      onEndReached={() =>
        lista.hasNextPage && !lista.isFetchingNextPage && void lista.fetchNextPage()
      }
      ListEmptyComponent={
        <Aviso
          icone="notifications-outline"
          titulo="Nada por aqui ainda"
          texto="Curtidas, comentários, menções e conexões novas aparecem aqui."
        />
      }
      renderItem={({ item }) => {
        const selo = SELOS[item.tipo];
        const imagem = enderecoDaFoto(item.post?.imagemUrl);
        return (
          <Pressable
            onPress={() => abrir(item)}
            style={({ pressed }) => [
              s.item,
              !item.lida && s.nova,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.ator?.apelido ?? 'Alguém'} ${item.frase}`}
          >
            <View>
              <Avatar
                nome={item.ator?.apelido ?? '?'}
                fotoUrl={item.ator?.fotoUrl}
                tamanho={48}
              />
              {selo ? (
                <View style={[s.selo, { backgroundColor: cor[selo.cor] }]}>
                  <Ionicons
                    name={selo.icone}
                    size={11}
                    color={
                      selo.cor === 'destaque'
                        ? c.sobreDestaque
                        : esquema === 'escuro'
                          ? c.fundo
                          : '#fff'
                    }
                  />
                </View>
              ) : null}
            </View>
            <View style={s.textos}>
              <Text style={s.frase} numberOfLines={3}>
                <Text style={s.nome}>{item.ator?.apelido ?? 'Alguém'}</Text> {item.frase}
                {item.texto ? <Text style={s.trecho}>: “{item.texto}”</Text> : null}
              </Text>
              <Text style={s.hora}>{quando(item.criadoEm)}</Text>
            </View>
            {imagem ? <Image source={{ uri: imagem }} style={s.miniatura} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: { paddingVertical: espaco.p, width: '100%', maxWidth: 640, alignSelf: 'center' },
  vazia: { flexGrow: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: espaco.m,
    marginHorizontal: espaco.p,
    borderRadius: raio.g,
  },
  nova: { backgroundColor: c.marcaSuave },
  selo: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.fundo,
  },
  textos: { flex: 1, gap: 2 },
  frase: { fontFamily: fonte.regular, fontSize: 14.5, lineHeight: 20, color: c.texto },
  nome: { fontFamily: fonte.negrito },
  trecho: { color: c.textoSuave },
  hora: { fontFamily: fonte.medio, fontSize: 12, color: c.textoSuave },
  miniatura: { width: 46, height: 46, borderRadius: 10, backgroundColor: c.superficieAlta },
}));
