import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import type { Mensagem } from '@/api/tipos';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { enderecoDaFoto } from '@/utils/endereco';
import { Avatar } from './Avatar';

/** Prévia de uma publicação compartilhada dentro da conversa. */
export function PostNaMensagem({ post }: { post: NonNullable<Mensagem['post']> }) {
  const s = useEstilos();
  const { c } = useTema();
  if ('indisponivel' in post) {
    return (
      <View style={[s.cartao, s.indisponivel]}>
        <Ionicons name="eye-off-outline" size={16} color={c.textoSuave} />
        <Text style={s.cinza}>Publicação indisponível</Text>
      </View>
    );
  }
  const imagem = enderecoDaFoto(post.imagemUrl);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      style={({ pressed }) => [s.cartao, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Publicação de ${post.autor.apelido}`}
    >
      <View style={s.autor}>
        <Avatar nome={post.autor.apelido} fotoUrl={post.autor.fotoUrl} tamanho={22} />
        <Text style={s.nome}>{post.autor.apelido}</Text>
      </View>
      {imagem ? <Image source={{ uri: imagem }} style={s.imagem} /> : null}
      {post.texto ? (
        <Text style={s.texto} numberOfLines={4}>
          {post.texto}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useEstilos = criarEstilos((c) => ({
  cartao: {
    width: 230,
    backgroundColor: c.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: c.borda,
    overflow: 'hidden',
    marginBottom: 4,
  },
  indisponivel: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: espaco.m },
  cinza: { fontFamily: fonte.medio, fontSize: 13, color: c.textoSuave },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  nome: { fontFamily: fonte.negrito, fontSize: 13, color: c.texto },
  imagem: { width: '100%', aspectRatio: 1, backgroundColor: c.superficieAlta },
  texto: {
    fontFamily: fonte.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: c.texto,
    padding: 10,
  },
}));
