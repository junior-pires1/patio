import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { Post } from '@/api/tipos';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
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
  const { c } = useTema();
  const estilos = useEstilos();
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

  const coordenacao = post.autor.papel === 'COORDENACAO';

  return (
    <View style={estilos.cartao}>
      <View style={estilos.topo}>
        <Pressable
          onPress={abrirAutor}
          style={estilos.autorToque}
          accessibilityRole="button"
          accessibilityLabel={`Perfil de ${post.autor.apelido}`}
        >
          <Avatar nome={post.autor.apelido} fotoUrl={post.autor.fotoUrl} tamanho={42} />
          <View style={estilos.flex}>
            <View style={estilos.linhaAutor}>
              <Text style={estilos.autor} numberOfLines={1}>
                {post.autor.apelido}
              </Text>
              {coordenacao ? (
                <Ionicons name="shield-checkmark" size={14} color={c.marca} />
              ) : null}
            </View>
            <Text style={estilos.meta}>
              {coordenacao ? 'Coordenação · ' : ''}
              {quando(post.criadoEm)}
            </Text>
          </View>
        </Pressable>
        <View
          style={[
            estilos.categoria,
            post.categoria === 'EVENTO' && estilos.categoriaEvento,
          ]}
        >
          <Text
            style={[
              estilos.categoriaTexto,
              post.categoria === 'EVENTO' && estilos.categoriaTextoEvento,
            ]}
          >
            {cat.rotulo}
          </Text>
        </View>
        {post.meu ? (
          <Pressable
            onPress={confirmarRemocao}
            hitSlop={10}
            style={estilos.lixeira}
            accessibilityLabel="Remover publicação"
          >
            <Ionicons name="trash-outline" size={18} color={c.textoFraco} />
          </Pressable>
        ) : null}
      </View>

      {post.texto ? (
        <Pressable onPress={abrir} disabled={detalhe}>
          <Text style={[estilos.texto, detalhe && estilos.textoGrande]}>{post.texto}</Text>
        </Pressable>
      ) : null}
      {post.imagemUrl ? (
        <Imagem
          url={post.imagemUrl}
          style={[estilos.imagem, detalhe && estilos.imagemGrande]}
        />
      ) : null}

      {post.categoria === 'EVENTO' && post.eventoInicio ? (
        <View style={estilos.evento}>
          <View style={estilos.eventoIcone}>
            <Ionicons name="calendar" size={20} color={c.sobreDestaque} />
          </View>
          <View style={[estilos.flex, estilos.eventoTextos]}>
            <Text style={estilos.eventoData}>{dataDoEvento(post.eventoInicio)}</Text>
            {post.eventoLocal ? (
              <Info icone="location-outline">{post.eventoLocal}</Info>
            ) : null}
            <Text style={estilos.meta}>
              {post.presencas === 1 ? '1 confirmado' : `${post.presencas} confirmados`}
            </Text>
          </View>
          <Pressable
            onPress={() => (post.vou ? desmarcar.mutate() : presenca.mutate())}
            style={({ pressed }) => [
              estilos.vou,
              post.vou ? estilos.vouAtivo : null,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ checked: post.vou }}
          >
            {post.vou ? <Ionicons name="checkmark" size={16} color={c.sobreMarca} /> : null}
            <Text style={[estilos.vouTexto, post.vou && { color: c.sobreMarca }]}>
              {post.vou ? 'Vou' : 'Eu vou'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={estilos.acoes}>
        <Pressable
          onPress={() => curtir.mutate()}
          style={({ pressed }) => [
            estilos.acao,
            post.curti && estilos.acaoAtiva,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel={post.curti ? 'Descurtir' : 'Curtir'}
        >
          <Ionicons
            name={post.curti ? 'heart' : 'heart-outline'}
            size={19}
            color={post.curti ? c.erro : c.textoSuave}
          />
          <Text style={[estilos.contagem, post.curti && { color: c.erro }]}>
            {post.curtidas}
          </Text>
        </Pressable>
        <Pressable
          onPress={abrir}
          style={({ pressed }) => [estilos.acao, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Comentários"
        >
          <Ionicons name="chatbubble-outline" size={18} color={c.textoSuave} />
          <Text style={estilos.contagem}>{post.comentarios}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  cartao: {
    backgroundColor: c.superficie,
    borderRadius: raio.gg - 4,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
    gap: espaco.m,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.p },
  autorToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  flex: { flex: 1 },
  linhaAutor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  autor: { ...tipo.nome, color: c.texto, flexShrink: 1 },
  meta: { ...tipo.apoio, color: c.textoSuave },
  categoria: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: raio.total,
    backgroundColor: c.superficieAlta,
  },
  categoriaEvento: { backgroundColor: c.destaqueSuave },
  categoriaTexto: { fontFamily: fonte.semi, fontSize: 12, color: c.textoSuave },
  categoriaTextoEvento: { color: c.texto },
  lixeira: { padding: 4 },
  texto: { ...tipo.corpo, fontSize: 15.5, lineHeight: 23, color: c.texto },
  textoGrande: { fontSize: 17, lineHeight: 26 },
  imagem: { width: '100%', aspectRatio: 4 / 3, borderRadius: raio.g },
  imagemGrande: { aspectRatio: 1 },
  evento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    borderRadius: raio.g,
    padding: espaco.m,
    backgroundColor: c.superficieAlta,
  },
  eventoIcone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventoTextos: { gap: 2 },
  eventoData: { ...tipo.nome, color: c.texto },
  vou: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: raio.total,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: c.marcaSuave,
  },
  vouAtivo: { backgroundColor: c.marca },
  vouTexto: { fontFamily: fonte.negrito, fontSize: 14, color: c.marca },
  acoes: { flexDirection: 'row', gap: espaco.p, marginLeft: -6 },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: raio.total,
  },
  acaoAtiva: { backgroundColor: c.erroSuave },
  contagem: { fontFamily: fonte.semi, fontSize: 14, color: c.textoSuave },
}));
