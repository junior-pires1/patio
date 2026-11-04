import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Post } from '@/api/tipos';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, raio, suave } from '@/tema';
import { dataDoEvento, quando } from '@/utils/datas';
import { categoria } from '@/utils/opcoes';
import { Avatar } from './Avatar';
import { Imagem } from './Imagem';
import { Info } from './Info';
import { alerta } from '@/utils/alerta';

type Props = { post: Post; detalhe?: boolean };

/** Publicação do feed: autor, texto, evento (com presença), curtidas e comentários. */
export function CartaoPost({ post, detalhe = false }: Props) {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const cat = categoria(post.categoria);

  // Atualiza o post em todas as listas em cache sem buscar de novo.
  const aplicar = (mudanca: Partial<Post>) => {
    queryClient.setQueriesData<{ pages: { posts: Post[] }[] }>(
      { queryKey: ['feed'] },
      (dados) =>
        dados
          ? {
              ...dados,
              pages: dados.pages.map((p) => ({
                ...p,
                posts: p.posts.map((x) => (x.id === post.id ? { ...x, ...mudanca } : x)),
              })),
            }
          : dados,
    );
    queryClient.setQueryData<Post>(['post', post.id], (p) =>
      p ? { ...p, ...mudanca } : p,
    );
  };

  const curtir = useMutation({
    mutationFn: () =>
      post.curti
        ? api
            .delete(`/posts/${post.id}/curtida`)
            .then(() => ({ curti: false, curtidas: post.curtidas - 1 }))
        : api.put<{ curti: boolean; curtidas: number }>(`/posts/${post.id}/curtida`, {}),
    onSuccess: (r) => aplicar(r),
  });
  const presenca = useMutation({
    mutationFn: () =>
      api
        .put<{ vou: boolean; presencas: number }>(`/posts/${post.id}/presenca`, {})
        .then((r) => r),
    onSuccess: (r) => aplicar(r),
  });
  const desmarcar = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}/presenca`),
    onSuccess: () => aplicar({ vou: false, presencas: Math.max(0, post.presencas - 1) }),
  });
  const remover = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (detalhe) router.back();
    },
  });

  function confirmarRemocao() {
    alerta('Remover publicação?', 'Ela some do feed para todos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => remover.mutate() },
    ]);
  }

  // Coordenação não tem perfil social; alunos abrem o perfil.
  const abrirAutor = () =>
    post.autor.papel === 'ALUNO' &&
    router.push({ pathname: '/usuario/[id]', params: { id: post.autor.id } });

  const abrir = () =>
    !detalhe && router.push({ pathname: '/post/[id]', params: { id: post.id } });

  return (
    <View style={estilos.cartao}>
      <View style={estilos.topo}>
        <Pressable
          onPress={abrirAutor}
          style={estilos.autorToque}
          accessibilityRole="button"
          accessibilityLabel={`Perfil de ${post.autor.apelido}`}
        >
          <Avatar nome={post.autor.apelido} fotoUrl={post.autor.fotoUrl} tamanho={40} />
          <View style={estilos.flex}>
            <Text style={estilos.autor}>
              {post.autor.apelido}
              {post.autor.papel === 'COORDENACAO' ? ' · Coordenação' : ''}
            </Text>
            <Text style={estilos.meta}>
              {cat.rotulo} · {quando(post.criadoEm)}
            </Text>
          </View>
        </Pressable>
        {post.meu ? (
          <Pressable
            onPress={confirmarRemocao}
            hitSlop={10}
            accessibilityLabel="Remover publicação"
          >
            <Ionicons name="trash-outline" size={20} color={cores.textoSuave} />
          </Pressable>
        ) : null}
      </View>

      {post.texto ? (
        <Pressable onPress={abrir} disabled={detalhe}>
          <Text style={estilos.texto}>{post.texto}</Text>
        </Pressable>
      ) : null}
      {post.imagemUrl ? (
        <Imagem
          url={post.imagemUrl}
          style={[estilos.imagem, detalhe && estilos.imagemGrande]}
        />
      ) : null}

      {post.categoria === 'EVENTO' && post.eventoInicio ? (
        <View style={[estilos.evento, { backgroundColor: suave(cor) }]}>
          <View style={estilos.flex}>
            <Info icone="calendar-outline" cor={cores.texto} estilo={estilos.eventoData}>
              {dataDoEvento(post.eventoInicio)}
            </Info>
            {post.eventoLocal ? (
              <Info icone="location-outline">{post.eventoLocal}</Info>
            ) : null}
            <Text style={estilos.meta}>{post.presencas} confirmado(s)</Text>
          </View>
          <Pressable
            onPress={() => (post.vou ? desmarcar.mutate() : presenca.mutate())}
            style={[
              estilos.vou,
              post.vou ? { backgroundColor: cor } : { borderColor: cor, borderWidth: 1.5 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ checked: post.vou }}
          >
            <Text style={[estilos.vouTexto, { color: post.vou ? '#fff' : cor }]}>
              {post.vou ? 'Vou' : 'Eu vou'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={estilos.acoes}>
        <Pressable
          onPress={() => curtir.mutate()}
          style={estilos.acao}
          accessibilityLabel={post.curti ? 'Descurtir' : 'Curtir'}
        >
          <Ionicons
            name={post.curti ? 'thumbs-up' : 'thumbs-up-outline'}
            size={20}
            color={post.curti ? cor : cores.textoSuave}
          />
          <Text style={estilos.contagem}>{post.curtidas}</Text>
        </Pressable>
        <Pressable onPress={abrir} style={estilos.acao} accessibilityLabel="Comentários">
          <Ionicons name="chatbubble-outline" size={19} color={cores.textoSuave} />
          <Text style={estilos.contagem}>{post.comentarios}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: espaco.m,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  autorToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  flex: { flex: 1 },
  autor: { fontSize: 15, fontWeight: '700', color: cores.texto },
  meta: { fontSize: 13, color: cores.textoSuave },
  texto: { fontSize: 16, color: cores.texto, lineHeight: 22 },
  imagem: { width: '100%', aspectRatio: 4 / 3, borderRadius: raio.m },
  imagemGrande: { aspectRatio: 1 },
  evento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    borderRadius: raio.m,
    padding: espaco.m,
  },
  eventoData: { fontSize: 15, fontWeight: '700', color: cores.texto },
  vou: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  vouTexto: { fontWeight: '700', fontSize: 14 },
  acoes: { flexDirection: 'row', gap: espaco.gg },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contagem: { fontSize: 14, color: cores.textoSuave },
});
