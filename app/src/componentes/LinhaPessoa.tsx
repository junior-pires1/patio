import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PessoaResumo } from '@/api/tipos';
import { cores, espaco } from '@/tema';
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
  return (
    <View style={estilos.linha}>
      <Pressable
        style={estilos.toque}
        onPress={() =>
          router.push({ pathname: '/usuario/[id]', params: { id: pessoa.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={`Perfil de ${pessoa.apelido}`}
      >
        <Avatar nome={pessoa.apelido} fotoUrl={pessoa.fotoUrl} tamanho={46} />
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

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingVertical: espaco.p,
  },
  toque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  textos: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '700', color: cores.texto },
  sub: { fontSize: 13, color: cores.textoSuave },
});
