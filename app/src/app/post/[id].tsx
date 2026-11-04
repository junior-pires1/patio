import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
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
import type { Comentario, Post } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Aviso, Carregando } from '@/componentes/Estados';
import { SugestoesDeMencao } from '@/componentes/SugestoesDeMencao';
import { TextoRico } from '@/componentes/TextoRico';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { quando } from '@/utils/datas';
import { useMencoes } from '@/utils/mencoes';

/** RF19: publicação com comentários, respostas, curtidas e @menções (estilo Instagram). */
export default function TelaPost() {
  const estilos = useEstilos();
  const { c } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const entrada = useMencoes();
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const [respondendo, setRespondendo] = useState<Comentario | null>(null);

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
    mutationFn: () =>
      api.post<Comentario>(`/posts/${id}/comentarios`, {
        texto: entrada.texto.trim(),
        mencoes: entrada.mencoes,
        ...(respondendo ? { paiId: respondendo.id } : {}),
      }),
    onSuccess: () => {
      entrada.limpar();
      setRespondendo(null);
      atualizar();
    },
    onError: (e) => alerta('Comentário não enviado', e.message),
  });
  const apagar = useMutation({
    mutationFn: (cid: string) => api.delete(`/comentarios/${cid}`),
    onSuccess: atualizar,
  });
  const curtir = useMutation({
    mutationFn: async (co: Comentario) => {
      if (co.curti) await api.delete(`/comentarios/${co.id}/curtida`);
      else await api.put(`/comentarios/${co.id}/curtida`, {});
    },
    // Muda na hora; se der erro, busca de novo.
    onMutate: (co) =>
      trocar(co.id, { curti: !co.curti, curtidas: co.curtidas + (co.curti ? -1 : 1) }),
    onError: () => atualizar(),
  });

  function trocar(cid: string, mudanca: Partial<Comentario>) {
    queryClient.setQueryData<Comentario[]>(['comentarios', id], (lista) =>
      lista?.map((co) => ({
        ...(co.id === cid ? { ...co, ...mudanca } : co),
        respostas: co.respostas.map((r) => (r.id === cid ? { ...r, ...mudanca } : r)),
      })),
    );
  }

  function responder(co: Comentario) {
    setRespondendo(co);
    entrada.marcar({ id: co.autor.id, apelido: co.autor.apelido });
    campo.current?.focus();
  }

  if (post.isPending) return <Carregando />;
  if (post.isError)
    return (
      <Aviso
        icone="document-text-outline"
        titulo="Publicação indisponível"
        texto={post.error.message}
      />
    );

  const linha = (co: Comentario, resposta = false) => (
    <View key={co.id} style={[estilos.comentario, resposta && estilos.resposta]}>
      <Pressable
        onPress={() =>
          co.autor.papel === 'ALUNO' &&
          router.push({ pathname: '/usuario/[id]', params: { id: co.autor.id } })
        }
        accessibilityLabel={`Perfil de ${co.autor.apelido}`}
      >
        <Avatar
          nome={co.autor.apelido}
          fotoUrl={co.autor.fotoUrl}
          tamanho={resposta ? 28 : 34}
        />
      </Pressable>
      <View style={estilos.corpo}>
        <View style={estilos.balao}>
          <Text style={estilos.autor}>{co.autor.apelido}</Text>
          <TextoRico texto={co.texto} mencoes={co.mencoes} estilo={estilos.texto} />
        </View>
        <View style={estilos.acoes}>
          <Text style={estilos.hora}>{quando(co.criadoEm)}</Text>
          {co.curtidas > 0 ? (
            <Text style={estilos.hora}>
              {co.curtidas === 1 ? '1 curtida' : `${co.curtidas} curtidas`}
            </Text>
          ) : null}
          <Pressable onPress={() => responder(co)} hitSlop={8} accessibilityRole="button">
            <Text style={estilos.acao}>Responder</Text>
          </Pressable>
          {co.meu ? (
            <Pressable
              onPress={() =>
                alerta('Apagar comentário?', undefined, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Apagar',
                    style: 'destructive',
                    onPress: () => apagar.mutate(co.id),
                  },
                ])
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Apagar comentário"
            >
              <Text style={estilos.acao}>Apagar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={() => curtir.mutate(co)}
        hitSlop={10}
        style={estilos.coracao}
        accessibilityRole="button"
        accessibilityLabel={co.curti ? 'Descurtir comentário' : 'Curtir comentário'}
      >
        <Ionicons
          name={co.curti ? 'heart' : 'heart-outline'}
          size={16}
          color={co.curti ? c.erro : c.textoFraco}
        />
      </Pressable>
    </View>
  );

  const podeEnviar = entrada.texto.trim().length > 0 && !comentar.isPending;

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
          keyExtractor={(co) => co.id}
          ListHeaderComponent={
            <View style={estilos.cabecalho}>
              <CartaoPost post={post.data} detalhe />
              {(comentarios.data?.length ?? 0) > 0 ? (
                <Text style={estilos.titulo}>Comentários</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            comentarios.isPending ? undefined : (
              <Text style={estilos.vazio}>Nenhum comentário ainda. Comece a conversa.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={estilos.fio}>
              {linha(item)}
              {item.respostas.map((r) => linha(r, true))}
            </View>
          )}
        />
        <SugestoesDeMencao sugestoes={entrada.sugestoes} aoEscolher={entrada.escolher} />
        {respondendo ? (
          <View style={estilos.respondendo}>
            <Text style={estilos.respondendoTexto} numberOfLines={1}>
              Respondendo a {respondendo.autor.apelido}
            </Text>
            <Pressable
              onPress={() => {
                setRespondendo(null);
                entrada.limpar();
              }}
              hitSlop={10}
              accessibilityLabel="Cancelar resposta"
            >
              <Ionicons name="close" size={18} color={c.textoSuave} />
            </Pressable>
          </View>
        ) : null}
        <View style={estilos.barra}>
          <TextInput
            ref={campo}
            style={estilos.entrada}
            placeholder={
              respondendo
                ? 'Escreva sua resposta'
                : 'Escreva um comentário (use @ para marcar)'
            }
            placeholderTextColor={c.textoFraco}
            maxLength={300}
            value={entrada.texto}
            onChangeText={entrada.setTexto}
            accessibilityLabel="Comentário"
          />
          <Pressable
            onPress={() => podeEnviar && comentar.mutate()}
            disabled={!podeEnviar}
            style={[estilos.enviar, { opacity: podeEnviar ? 1 : 0.5 }]}
            accessibilityLabel="Enviar comentário"
          >
            <Ionicons name="arrow-up" size={20} color={c.sobreMarca} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: {
    padding: espaco.g,
    gap: espaco.g,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cabecalho: { gap: espaco.g },
  titulo: { fontFamily: fonte.negrito, fontSize: 16, color: c.texto },
  vazio: {
    textAlign: 'center',
    color: c.textoSuave,
    fontFamily: fonte.medio,
    marginTop: espaco.p,
  },
  fio: { gap: espaco.m },
  comentario: { flexDirection: 'row', gap: espaco.p, alignItems: 'flex-start' },
  resposta: { marginLeft: 42 },
  corpo: { flex: 1, gap: 4 },
  balao: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: c.superficie,
    borderRadius: 16,
    borderTopLeftRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.borda,
  },
  autor: { fontSize: 13.5, fontFamily: fonte.negrito, color: c.texto },
  texto: {
    fontFamily: fonte.regular,
    fontSize: 15,
    lineHeight: 21,
    color: c.texto,
    marginTop: 1,
  },
  acoes: { flexDirection: 'row', gap: espaco.m, paddingLeft: 4 },
  hora: { fontFamily: fonte.medio, color: c.textoSuave, fontSize: 12 },
  acao: { fontFamily: fonte.negrito, color: c.textoSuave, fontSize: 12 },
  coracao: { paddingTop: 12, paddingHorizontal: 2 },
  respondendo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.g,
    paddingVertical: 8,
    backgroundColor: c.superficieAlta,
  },
  respondendoTexto: { fontFamily: fonte.semi, fontSize: 13, color: c.textoSuave, flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderColor: c.borda,
  },
  entrada: {
    flex: 1,
    minHeight: 44,
    borderRadius: raio.total,
    backgroundColor: c.superficieAlta,
    paddingHorizontal: 16,
    fontFamily: fonte.regular,
    fontSize: 15.5,
    color: c.texto,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
