import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MensagemGrupo } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco, raio } from '@/tema';
import { quando } from '@/utils/datas';
import { alerta } from '@/utils/alerta';

type Pagina = { mensagens: MensagemGrupo[]; temMais: boolean };

/** RF24: chat do grupo de estudo (só membros), atualizado em tempo real. */
export default function ChatDoGrupo() {
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
  const enviar = useMutation({
    mutationFn: (t: string) =>
      api.post<MensagemGrupo>(`/grupos/${id}/mensagens`, { texto: t }),
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
          data={[...mensagens.data.mensagens].reverse()}
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
                <Text style={[estilos.texto, minha && estilos.textoMinha]}>
                  {item.texto}
                </Text>
                <Text style={[estilos.hora, minha && estilos.horaMinha]}>
                  {quando(item.criadoEm)}
                </Text>
              </View>
            );
          }}
        />
        <View style={estilos.barra}>
          <TextInput
            style={estilos.entrada}
            placeholder="Mensagem para o grupo"
            placeholderTextColor="#9AA3AE"
            multiline
            maxLength={1000}
            value={texto}
            onChangeText={setTexto}
            accessibilityLabel="Mensagem"
          />
          <Pressable
            onPress={() => texto.trim() && enviar.mutate(texto.trim())}
            disabled={!texto.trim() || enviar.isPending}
            style={[
              estilos.enviar,
              { backgroundColor: cor, opacity: texto.trim() ? 1 : 0.5 },
            ]}
            accessibilityLabel="Enviar"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.m, gap: 6, flexGrow: 1 },
  balao: {
    maxWidth: '80%',
    borderRadius: raio.m,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  minha: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  dele: {
    alignSelf: 'flex-start',
    backgroundColor: cores.superficie,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  autor: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  texto: { fontSize: 16, color: cores.texto },
  textoMinha: { color: '#fff' },
  hora: { fontSize: 11, color: cores.textoSuave, marginTop: 2, alignSelf: 'flex-end' },
  horaMinha: { color: 'rgba(255,255,255,0.8)' },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderColor: cores.borda,
  },
  entrada: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: cores.fundo,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: cores.texto,
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
