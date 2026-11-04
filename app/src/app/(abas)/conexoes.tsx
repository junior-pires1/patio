import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { Conexao } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';

export default function Conexoes() {
  const estilos = useEstilos();
  const { c } = useTema();
  const { api } = useSessao();
  const eu = useUsuario();
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

  // Conexões sem mensagem ficam numa faixa no topo, como nos apps de match.
  const novas = conexoes.data.filter((x) => !x.ultimaMensagem);
  const conversas = conexoes.data.filter((x) => x.ultimaMensagem);
  const abrir = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  const faixa =
    novas.length > 0 ? (
      <View style={estilos.faixa}>
        <Text style={estilos.tituloFaixa}>Novas conexões</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.novas}
        >
          {novas.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => abrir(n.id)}
              style={({ pressed }) => [estilos.nova, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Conversa com ${n.pessoa.apelido}`}
            >
              <View style={estilos.anelNova}>
                <Avatar nome={n.pessoa.apelido} fotoUrl={n.pessoa.fotoUrl} tamanho={62} />
              </View>
              <Text style={estilos.nomeNova} numberOfLines={1}>
                {n.pessoa.apelido}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {conversas.length > 0 ? <Text style={estilos.tituloFaixa}>Mensagens</Text> : null}
      </View>
    ) : null;

  return (
    <FlatList
      data={conversas}
      keyExtractor={(c) => c.id}
      style={estilos.lista}
      ListHeaderComponent={faixa ?? undefined}
      contentContainerStyle={[
        estilos.conteudo,
        conexoes.data.length === 0 ? estilos.vazia : null,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={conexoes.isRefetching}
          onRefresh={() => void conexoes.refetch()}
        />
      }
      ListEmptyComponent={
        novas.length > 0 ? (
          <Text style={estilos.dicaOi}>Toque numa conexão para mandar o primeiro oi.</Text>
        ) : (
          <Aviso
            icone="chatbubbles-outline"
            titulo="Nenhuma conexão ainda"
            texto="Quando você e um colega se curtirem, a conversa aparece aqui."
            acao={{ titulo: 'Descobrir colegas', aoTocar: () => router.navigate('/') }}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      renderItem={({ item }) => {
        const ultima = item.ultimaMensagem;
        const previa = ultima
          ? `${ultima.autorId === eu.id ? 'Você: ' : ''}${ultima.resumo ?? ultima.texto}`
          : 'Diga oi!';
        return (
          <Pressable
            style={({ pressed }) => [estilos.item, pressed && { opacity: 0.7 }]}
            onPress={() => abrir(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Conversa com ${item.pessoa.apelido}`}
          >
            <Avatar nome={item.pessoa.apelido} fotoUrl={item.pessoa.fotoUrl} tamanho={54} />
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
                <View style={[estilos.bolinha, { backgroundColor: c.marca }]}>
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

const useEstilos = criarEstilos((c) => ({
  lista: { flex: 1, backgroundColor: c.fundo },
  conteudo: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: espaco.g },
  vazia: { flexGrow: 1 },
  faixa: { paddingTop: espaco.p, gap: espaco.m },
  tituloFaixa: { ...tipo.sobrescrito, color: c.textoSuave, paddingHorizontal: espaco.g },
  novas: { paddingHorizontal: espaco.g, gap: espaco.m },
  nova: { alignItems: 'center', width: 74, gap: 6 },
  anelNova: { borderWidth: 2.5, borderColor: c.destaque, borderRadius: 999, padding: 2.5 },
  nomeNova: { fontFamily: fonte.semi, fontSize: 12.5, color: c.texto, maxWidth: 74 },
  dicaOi: { ...tipo.apoio, color: c.textoSuave, textAlign: 'center', padding: espaco.gg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: espaco.m,
  },
  textos: { flex: 1, gap: 2 },
  nome: { ...tipo.nome, fontSize: 16, color: c.texto },
  previa: { fontFamily: fonte.regular, fontSize: 14, color: c.textoSuave },
  previaForte: { color: c.texto, fontFamily: fonte.semi },
  lado: { alignItems: 'flex-end', gap: 6 },
  hora: { fontFamily: fonte.regular, fontSize: 12, color: c.textoSuave },
  bolinha: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bolinhaTexto: { color: c.sobreMarca, fontSize: 12, fontFamily: fonte.negrito },
  separador: { height: 1, backgroundColor: c.borda, marginLeft: 82 },
}));
