import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import type { Destaque, Story } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando, MensagemDeErro } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { espaco } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { enderecoDaFoto } from '@/utils/endereco';
import { voltar } from '@/utils/navegacao';

/** Criar (ou editar, com ?id=) um destaque escolhendo stories do arquivo. */
export default function NovoDestaque() {
  const estilos = useEstilos();
  const { c } = useTema();
  const b = useBase();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const arquivo = useQuery({
    queryKey: ['arquivo-stories'],
    queryFn: () => api.get<Story[]>('/eu/stories/arquivo'),
  });
  const existente = useQuery({
    queryKey: ['destaque', id],
    queryFn: () => api.get<Destaque>(`/destaques/${id}`),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (!existente.data) return;
    // Preenche uma vez com o destaque que está sendo editado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitulo(existente.data.titulo);
    setEscolhidos(existente.data.stories.map((s) => s.id));
  }, [existente.data]);

  const alternar = (sid: string) =>
    setEscolhidos((l) => (l.includes(sid) ? l.filter((x) => x !== sid) : [...l, sid]));

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const corpo = { titulo: titulo.trim(), storyIds: escolhidos };
      if (id) await api.patch(`/destaques/${id}`, corpo);
      else await api.post('/destaques', corpo);
      void queryClient.invalidateQueries({ queryKey: ['destaques', eu.id] });
      void queryClient.invalidateQueries({ queryKey: ['destaque', id] });
      voltar('/perfil');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (arquivo.isPending) return <Carregando />;

  return (
    <View style={estilos.fundo}>
      <Stack.Screen options={{ title: id ? 'Editar destaque' : 'Novo destaque' }} />
      <FlatList
        data={arquivo.data ?? []}
        keyExtractor={(s) => s.id}
        numColumns={3}
        columnWrapperStyle={estilos.colunas}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View style={estilos.cabecalho}>
            <Campo
              rotulo="Nome do destaque"
              placeholder="Ex.: Projetos, Eventos, Monitoria"
              maxLength={30}
              value={titulo}
              onChangeText={setTitulo}
            />
            <Text style={b.subtitulo}>
              Escolha os stories ({escolhidos.length} selecionado(s)). Só as suas conexões
              veem os destaques.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={b.subtitulo}>
            Você ainda não publicou stories. Publique um no topo do feed.
          </Text>
        }
        renderItem={({ item }) => {
          const marcado = escolhidos.includes(item.id);
          return (
            <Pressable
              style={estilos.celula}
              onPress={() => alternar(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado }}
            >
              <Image
                source={{ uri: enderecoDaFoto(item.imagemUrl)! }}
                style={[estilos.miniatura, marcado && { opacity: 0.6 }]}
              />
              <View
                style={[
                  estilos.marca,
                  marcado ? { backgroundColor: cor, borderColor: cor } : null,
                ]}
              >
                {marcado ? (
                  <Ionicons name="checkmark" size={14} color={c.sobreMarca} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={estilos.rodape}>
            <MensagemDeErro texto={erro} />
            <Botao
              titulo={id ? 'Salvar destaque' : 'Criar destaque'}
              aoTocar={salvar}
              carregando={salvando}
              desabilitado={!titulo.trim() || escolhidos.length === 0}
            />
          </View>
        }
      />
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: { padding: espaco.g, gap: 2 },
  cabecalho: { gap: espaco.m, marginBottom: espaco.m },
  colunas: { gap: 2 },
  celula: { flex: 1 / 3 },
  miniatura: { width: '100%', aspectRatio: 9 / 16, backgroundColor: c.borda },
  marca: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodape: { gap: espaco.m, marginTop: espaco.g },
}));
