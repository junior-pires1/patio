import Ionicons from '@expo/vector-icons/Ionicons';
import { useAmpliarFoto } from './FotoAmpliada';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { StoriesDaPessoa } from '@/api/tipos';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { Avatar } from './Avatar';

/** Bolinhas de stories no topo do feed: o seu primeiro, depois as conexões. */
export function BarraStories() {
  const { api } = useSessao();
  const eu = useUsuario();
  const { c } = useTema();
  const estilos = useEstilos();
  const ampliar = useAmpliarFoto();
  const stories = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<StoriesDaPessoa[]>('/stories'),
    enabled: eu.papel === 'ALUNO',
  });
  if (eu.papel !== 'ALUNO') return null;

  const lista = stories.data ?? [];
  const meus = lista.find((g) => g.meu);
  const outros = lista.filter((g) => !g.meu);
  const abrir = (autorId: string) =>
    router.push({ pathname: '/stories/[autorId]', params: { autorId } });

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={outros}
      keyExtractor={(g) => g.autor.id}
      contentContainerStyle={estilos.lista}
      ListHeaderComponent={
        <Pressable
          style={estilos.item}
          onPress={() => (meus ? abrir(eu.id) : router.push('/stories/novo'))}
          onLongPress={() => router.push('/stories/novo')}
          accessibilityRole="button"
          accessibilityLabel={meus ? 'Ver seu story' : 'Criar story'}
        >
          <View style={[estilos.anel, { borderColor: meus ? c.borda : 'transparent' }]}>
            <Avatar nome={eu.apelido} fotoUrl={eu.fotoUrl} tamanho={60} />
            <Pressable
              onPress={() => router.push('/stories/novo')}
              style={estilos.mais}
              hitSlop={6}
              accessibilityLabel="Novo story"
            >
              <Ionicons name="add" size={15} color={c.sobreDestaque} />
            </Pressable>
          </View>
          <Text style={estilos.nome} numberOfLines={1}>
            Seu story
          </Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          style={estilos.item}
          onPress={() => abrir(item.autor.id)}
          {...ampliar(item.autor.apelido, item.autor.fotoUrl)}
          accessibilityRole="button"
          accessibilityLabel={`Stories de ${item.autor.apelido}`}
        >
          <View
            style={[estilos.anel, { borderColor: item.todosVistos ? c.borda : c.marca }]}
          >
            <Avatar nome={item.autor.apelido} fotoUrl={item.autor.fotoUrl} tamanho={60} />
          </View>
          <Text style={estilos.nome} numberOfLines={1}>
            {item.autor.apelido}
          </Text>
        </Pressable>
      )}
    />
  );
}

const useEstilos = criarEstilos((c) => ({
  lista: { gap: espaco.m, paddingVertical: 2 },
  item: { alignItems: 'center', width: 72, gap: 6 },
  anel: { borderWidth: 2.5, borderRadius: 999, padding: 2.5 },
  mais: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.destaque,
    borderWidth: 2.5,
    borderColor: c.fundo,
  },
  nome: { fontSize: 12, fontFamily: fonte.medio, color: c.texto, maxWidth: 72 },
}));
