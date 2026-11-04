import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MensagemGrupo } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Imagem } from '@/componentes/Imagem';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';
import { alerta } from '@/utils/alerta';
import { escolherImagem } from '@/utils/foto';
import { useMensagensAntigas } from '@/utils/mensagensAntigas';

type Pagina = { mensagens: MensagemGrupo[]; temMais: boolean };

/** RF24: chat do grupo de estudo (só membros), atualizado em tempo real. */
export default function ChatDoGrupo() {
  const estilos = useEstilos();
  const { c } = useTema();
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');

  const mensagens = useQuery({
    queryKey: ['grupo-mensagens', id],
    queryFn: () => api.get<Pagina>(`/grupos/${id}/mensagens`),
  });
  const antigas = useMensagensAntigas(`/grupos/${id}/mensagens`, mensagens.data);
  const enviar = useMutation({
    mutationFn: async ({ t, imagem }: { t: string; imagem?: Blob }) => {
      const enviada = imagem ? await api.enviarImagem(imagem) : null;
      return api.post<MensagemGrupo>(`/grupos/${id}/mensagens`, {
        texto: t,
        ...(enviada ? { imagemId: enviada.id } : {}),
      });
    },
    onSuccess: (nova) => {
      setTexto('');
      queryClient.setQueryData<Pagina>(['grupo-mensagens', id], (p) =>
        p && !p.mensagens.some((m) => m.id === nova.id)
          ? { ...p, mensagens: [...p.mensagens, nova] }
          : p,
      );
    },
    onError: (e) => alerta('Mensagem não enviada', e.message),
  });

  // A imagem vai na hora, com o texto digitado (se houver) como legenda.
  async function mandarImagem() {
    try {
      const escolhida = await escolherImagem();
      if (escolhida) enviar.mutate({ t: texto.trim(), imagem: escolhida.blob });
    } catch {
      alerta('Imagem não enviada', 'Não foi possível abrir a imagem.');
    }
  }

  const titulo = <Stack.Screen options={{ title: nome ?? 'Chat do grupo' }} />;
  if (mensagens.isPending)
    return (
      <>
        {titulo}
        <Carregando />
      </>
    );
  if (mensagens.isError)
    return (
      <>
        {titulo}
        <Aviso titulo="Chat indisponível" texto={mensagens.error.message} />
      </>
    );

  return (
    <SafeAreaView style={estilos.fundo} edges={['bottom', 'left', 'right']}>
      {titulo}
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          inverted
          data={[...antigas.todas].reverse()}
          onEndReached={() => void antigas.carregar()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            antigas.carregando ? (
              <Text style={estilos.carregando}>Carregando…</Text>
            ) : undefined
          }
          keyExtractor={(m) => m.id}
          contentContainerStyle={estilos.lista}
          renderItem={({ item }) => {
            const minha = item.autor.id === eu.id;
            return (
              <View
                style={[
                  estilos.balao,
                  minha ? [estilos.minha, { backgroundColor: cor }] : estilos.dele,
                ]}
              >
                {!minha ? (
                  <Text style={[estilos.autor, { color: cor }]}>{item.autor.apelido}</Text>
                ) : null}
                {item.imagemUrl ? (
                  <Imagem url={item.imagemUrl} style={estilos.foto} />
                ) : null}
                {item.texto ? (
                  <Text style={[estilos.texto, minha && estilos.textoMinha]}>
                    {item.texto}
                  </Text>
                ) : null}
                <Text style={[estilos.hora, minha && estilos.horaMinha]}>
                  {quando(item.criadoEm)}
                </Text>
              </View>
            );
          }}
        />
        <View style={estilos.barra}>
          <Pressable
            onPress={() => void mandarImagem()}
            disabled={enviar.isPending}
            style={estilos.anexo}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Enviar imagem"
          >
            <Ionicons name="image-outline" size={24} color={c.textoSuave} />
          </Pressable>
          <TextInput
            style={estilos.entrada}
            placeholder="Mensagem para o grupo"
            placeholderTextColor={c.textoFraco}
            multiline
            maxLength={1000}
            value={texto}
            onChangeText={setTexto}
            accessibilityLabel="Mensagem"
          />
          <Pressable
            onPress={() => texto.trim() && enviar.mutate({ t: texto.trim() })}
            disabled={!texto.trim() || enviar.isPending}
            style={[
              estilos.enviar,
              { backgroundColor: cor, opacity: texto.trim() ? 1 : 0.5 },
            ]}
            accessibilityLabel="Enviar"
          >
            <Ionicons name="arrow-up" size={20} color={c.sobreMarca} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useEstilos = criarEstilos((c) => ({
  carregando: {
    textAlign: 'center',
    color: c.textoSuave,
    padding: espaco.p,
  },
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: { padding: espaco.m, gap: 6, flexGrow: 1 },
  balao: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  minha: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  dele: {
    alignSelf: 'flex-start',
    backgroundColor: c.superficie,
    borderBottomLeftRadius: 6,
  },
  autor: { fontSize: 12, fontFamily: fonte.negrito, marginBottom: 2 },
  texto: { fontFamily: fonte.regular, fontSize: 15.5, lineHeight: 21, color: c.texto },
  textoMinha: { color: c.sobreMarca },
  hora: {
    fontFamily: fonte.regular,
    fontSize: 11,
    color: c.textoSuave,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  horaMinha: { color: c.sobreMarca, opacity: 0.75 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderColor: c.borda,
  },
  entrada: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: c.superficieAlta,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonte.regular,
    fontSize: 16,
    color: c.texto,
  },
  foto: { width: 220, height: 220, borderRadius: raio.p, marginBottom: 4 },
  anexo: { height: 42, justifyContent: 'center' },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
