import { router } from 'expo-router';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import type { Mencionado } from '@/api/tipos';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** #hashtag (letras, números e _) e @apelido das pessoas marcadas (apelido pode ter espaço). */
function padrao(mencoes: Mencionado[]) {
  const nomes = [...new Set(mencoes.map((m) => m.apelido))]
    .sort((a, b) => b.length - a.length)
    .map(escapar);
  const mencao = nomes.length > 0 ? `|@(?:${nomes.join('|')})` : '';
  return new RegExp(`(#[\\p{L}\\p{N}_]{2,40}${mencao})`, 'giu');
}

/**
 * Texto de publicação ou comentário com #hashtags e @menções tocáveis.
 * A menção só vira link quando o @apelido é de uma pessoa marcada no post.
 */
export function TextoRico({
  texto,
  mencoes = [],
  estilo,
  numberOfLines,
}: {
  texto: string;
  mencoes?: Mencionado[];
  estilo?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { c } = useTema();
  const link = { color: c.marca, fontFamily: fonte.semi };
  const partes = texto.split(padrao(mencoes));
  return (
    <Text style={estilo} numberOfLines={numberOfLines}>
      {partes.map((parte, i) => {
        if (parte.startsWith('#') && parte.length > 2) {
          const tag = parte.slice(1).toLowerCase();
          return (
            <Text
              key={i}
              style={link}
              onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag } })}
              accessibilityRole="link"
            >
              {parte}
            </Text>
          );
        }
        if (parte.startsWith('@')) {
          const pessoa = mencoes.find(
            (m) => m.apelido.toLowerCase() === parte.slice(1).toLowerCase(),
          );
          if (pessoa) {
            return (
              <Text
                key={i}
                style={link}
                onPress={() =>
                  router.push({ pathname: '/usuario/[id]', params: { id: pessoa.id } })
                }
                accessibilityRole="link"
              >
                {parte}
              </Text>
            );
          }
        }
        return parte;
      })}
    </Text>
  );
}
