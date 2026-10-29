import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Conexao } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco } from '@/tema';
import { quando } from '@/utils/datas';

export default function Conexoes() {
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const conexoes = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get<Conexao[]>('/matches'),
  });

  if (conexoes.isPending) return <Carregando />;
  if (conexoes.isError) {
    return (
      <Aviso
        titulo="Não deu para carregar"
        texto={conexoes.error.message}
        acao={{ titulo: 'Tentar de novo', aoTocar: () => void conexoes.refetch() }}
      />
    );
  }

  return (
    <FlatList
      data={conexoes.data}
      keyExtractor={(c) => c.id}
      style={estilos.lista}
      contentContainerStyle={conexoes.data.length === 0 ? estilos.vazia : undefined}
      refreshControl={
        <RefreshControl
          refreshing={conexoes.isRefetching}
          onRefresh={() => void conexoes.refetch()}
        />
      }
      ListEmptyComponent={
        <Aviso
          titulo="Nenhuma conexão ainda"
          texto="Quando você e um colega se curtirem, a conversa aparece aqui."
          acao={{ titulo: 'Descobrir colegas', aoTocar: () => router.navigate('/') }}
        />
      }
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      renderItem={({ item }) => {
        const ultima = item.ultimaMensagem;
        const previa = ultima
          ? `${ultima.autorId === eu.id ? 'Você: ' : ''}${ultima.texto}`
          : 'Diga oi! 👋';
        return (
          <Pressable
            style={({ pressed }) => [estilos.item, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Conversa com ${item.pessoa.apelido}`}
          >
            <Avatar nome={item.pessoa.apelido} fotoUrl={item.pessoa.fotoUrl} />
            <View style={estilos.textos}>
              <Text style={estilos.nome}>{item.pessoa.apelido}</Text>
              <Text
                style={[estilos.previa, item.naoLidas > 0 && estilos.previaForte]}
                numberOfLines={1}
              >
                {previa}
              </Text>
            </View>
            <View style={estilos.lado}>
              <Text style={estilos.hora}>{quando(ultima?.criadoEm ?? item.criadoEm)}</Text>
              {item.naoLidas > 0 ? (
                <View style={[estilos.bolinha, { backgroundColor: cor }]}>
                  <Text style={estilos.bolinhaTexto}>{item.naoLidas}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { flex: 1, backgroundColor: cores.superficie },
  vazia: { flexGrow: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, padding: espaco.g },
  textos: { flex: 1, gap: 2 },
  nome: { fontSize: 16, fontWeight: '700', color: cores.texto },
  previa: { fontSize: 14, color: cores.textoSuave },
  previaForte: { color: cores.texto, fontWeight: '600' },
  lado: { alignItems: 'flex-end', gap: 6 },
  hora: { fontSize: 12, color: cores.textoSuave },
  bolinha: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bolinhaTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  separador: { height: 1, backgroundColor: cores.borda, marginLeft: 76 },
});
