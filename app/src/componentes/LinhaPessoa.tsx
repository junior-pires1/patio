import { router } from 'expo-router';
import { useAmpliarFoto } from './FotoAmpliada';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PessoaResumo } from '@/api/tipos';
import { espaco, tipo } from '@/tema';
import { criarEstilos } from '@/tema-provedor';
import { Avatar } from './Avatar';

/** Uma pessoa numa lista (busca, curtidas): toque abre o perfil. */
export function LinhaPessoa({
  pessoa,
  detalhe,
  acao,
}: {
  pessoa: PessoaResumo;
  detalhe?: string;
  acao?: ReactNode;
}) {
  const sub =
    detalhe ??
    [pessoa.curso?.nome, pessoa.semestre ? `${pessoa.semestre}º semestre` : null]
      .filter(Boolean)
      .join(' · ');
  const estilos = useEstilos();
  const ampliar = useAmpliarFoto();
  return (
    <View style={estilos.linha}>
      <Pressable
        style={({ pressed }) => [estilos.toque, pressed && { opacity: 0.7 }]}
        onPress={() =>
          router.push({ pathname: '/usuario/[id]', params: { id: pessoa.id } })
        }
        {...ampliar(pessoa.apelido, pessoa.fotoUrl)}
        accessibilityRole="button"
        accessibilityLabel={`Perfil de ${pessoa.apelido}`}
      >
        <Avatar nome={pessoa.apelido} fotoUrl={pessoa.fotoUrl} tamanho={48} />
        <View style={estilos.textos}>
          <Text style={estilos.nome}>{pessoa.apelido}</Text>
          {sub ? (
            <Text style={estilos.sub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {acao}
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingVertical: 10,
  },
  toque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  textos: { flex: 1, gap: 1 },
  nome: { ...tipo.nome, color: c.texto },
  sub: { ...tipo.apoio, color: c.textoSuave },
}));
