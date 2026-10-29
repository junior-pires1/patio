import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
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
import type { Comentario, Post } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco } from '@/tema';
import { quando } from '@/utils/datas';
import { alerta } from '@/utils/alerta';

/** RF19: publicação com os comentários. */
export default function TelaPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');

  const post = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get<Post>(`/posts/${id}`),
  });
  const comentarios = useQuery({
    queryKey: ['comentarios', id],
    queryFn: () => api.get<Comentario[]>(`/posts/${id}/comentarios`),
  });
  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: ['comentarios', id] });
    void queryClient.invalidateQueries({ queryKey: ['post', id] });
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const comentar = useMutation({
    mutationFn: (t: string) =>
      api.post<Comentario>(`/posts/${id}/comentarios`, { texto: t }),
    onSuccess: () => {
      setTexto('');
      atualizar();
    },
    onError: (e) => alerta('Comentário não enviado', e.message),
  });
  const apagar = useMutation({
    mutationFn: (cid: string) => api.delete(`/comentarios/${cid}`),
    onSuccess: atualizar,
  });

  if (post.isPending) return <Carregando />;
  if (post.isError)
    return <Aviso titulo="Publicação indisponível" texto={post.error.message} />;

  return (
    <SafeAreaView style={estilos.fundo} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          contentContainerStyle={estilos.lista}
          data={comentarios.data ?? []}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={<CartaoPost post={post.data} detalhe />}
          ListEmptyComponent={
            comentarios.isPending ? undefined : (
              <Text style={estilos.vazio}>Nenhum comentário ainda.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={estilos.comentario}>
              <Avatar nome={item.autor.apelido} fotoUrl={item.autor.fotoUrl} tamanho={32} />
              <View style={estilos.balao}>
                <Text style={estilos.autor}>
                  {item.autor.apelido}{' '}
                  <Text style={estilos.hora}>· {quando(item.criadoEm)}</Text>
                </Text>
                <Text style={estilos.texto}>{item.texto}</Text>
              </View>
              {item.meu ? (
                <Pressable
                  onPress={() => apagar.mutate(item.id)}
                  hitSlop={10}
                  accessibilityLabel="Apagar comentário"
                >
                  <Ionicons name="close" size={18} color={cores.textoSuave} />
                </Pressable>
              ) : null}
            </View>
          )}
        />
        <View style={estilos.barra}>
          <TextInput
            style={estilos.entrada}
            placeholder="Escreva um comentário"
            placeholderTextColor="#9AA3AE"
            maxLength={300}
            value={texto}
            onChangeText={setTexto}
            accessibilityLabel="Comentário"
          />
          <Pressable
            onPress={() => texto.trim() && comentar.mutate(texto.trim())}
            disabled={!texto.trim() || comentar.isPending}
            style={[
              estilos.enviar,
              { backgroundColor: cor, opacity: texto.trim() ? 1 : 0.5 },
            ]}
            accessibilityLabel="Enviar comentário"
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
  lista: { padding: espaco.g, gap: espaco.m },
  vazio: { textAlign: 'center', color: cores.textoSuave, marginTop: espaco.g },
  comentario: { flexDirection: 'row', gap: espaco.p, alignItems: 'flex-start' },
  balao: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  autor: { fontSize: 14, fontWeight: '700', color: cores.texto },
  hora: { fontWeight: '400', color: cores.textoSuave, fontSize: 12 },
  texto: { fontSize: 15, color: cores.texto, marginTop: 2 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderColor: cores.borda,
  },
  entrada: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: cores.fundo,
    paddingHorizontal: 14,
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
