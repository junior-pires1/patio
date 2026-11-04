import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoriesDaPessoa } from '@/api/tipos';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco } from '@/tema';
import { Avatar } from './Avatar';

/** Bolinhas de stories no topo do feed: o seu primeiro, depois as conexões. */
export function BarraStories() {
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
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
          <View style={[estilos.anel, { borderColor: meus ? cores.borda : 'transparent' }]}>
            <Avatar nome={eu.apelido} fotoUrl={eu.fotoUrl} tamanho={58} />
            <Pressable
              onPress={() => router.push('/stories/novo')}
              style={[estilos.mais, { backgroundColor: cor }]}
              hitSlop={6}
              accessibilityLabel="Novo story"
            >
              <Ionicons name="add" size={14} color="#fff" />
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
          accessibilityRole="button"
          accessibilityLabel={`Stories de ${item.autor.apelido}`}
        >
          <View
            style={[estilos.anel, { borderColor: item.todosVistos ? cores.borda : cor }]}
          >
            <Avatar nome={item.autor.apelido} fotoUrl={item.autor.fotoUrl} tamanho={58} />
          </View>
          <Text style={estilos.nome} numberOfLines={1}>
            {item.autor.apelido}
          </Text>
        </Pressable>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.m, paddingVertical: 2 },
  item: { alignItems: 'center', width: 70, gap: 4 },
  anel: { borderWidth: 2.5, borderRadius: 999, padding: 2 },
  mais: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nome: { fontSize: 12, color: cores.texto, maxWidth: 70 },
});
