import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ResultadoBusca } from '@/api/tipos';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Chip } from '@/componentes/Chip';
import { Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { useSessao } from '@/sessao';
import { cores, espaco, estilosBase, raio } from '@/tema';

type Tipo = 'pessoas' | 'posts' | 'grupos';
const TIPOS: { valor: Tipo; rotulo: string }[] = [
  { valor: 'pessoas', rotulo: 'Pessoas' },
  { valor: 'posts', rotulo: 'Publicações' },
  { valor: 'grupos', rotulo: 'Grupos' },
];

/** Busca de pessoas (apelido, curso, habilidade, disciplina), publicações e grupos. */
export default function Busca() {
  const { api } = useSessao();
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  const [tipo, setTipo] = useState<Tipo>('pessoas');

  // Espera a pessoa parar de digitar antes de buscar.
  useEffect(() => {
    const espera = setTimeout(() => setTermo(texto.trim()), 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const busca = useQuery({
    queryKey: ['busca', termo, tipo],
    queryFn: () =>
      api.get<ResultadoBusca>(`/busca?q=${encodeURIComponent(termo)}&tipo=${tipo}`),
    enabled: termo.length >= 2,
  });

  const vazio = (
    <View style={estilos.vazio}>
      <Ionicons name="search-outline" size={40} color={cores.textoSuave} />
      <Text style={[estilosBase.subtitulo, estilos.centro]}>
        {termo.length < 2
          ? 'Procure por apelido, curso, habilidade (ex.: Python) ou disciplina.'
          : 'Nada encontrado.'}
      </Text>
    </View>
  );

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.campo}>
        <Ionicons name="search" size={18} color={cores.textoSuave} />
        <TextInput
          style={estilos.entrada}
          placeholder="Buscar na faculdade"
          placeholderTextColor="#9AA3AE"
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Buscar"
        />
        {texto ? (
          <Pressable onPress={() => setTexto('')} hitSlop={8} accessibilityLabel="Limpar">
            <Ionicons name="close-circle" size={18} color={cores.textoSuave} />
          </Pressable>
        ) : null}
      </View>
      <View style={estilos.chips}>
        {TIPOS.map((t) => (
          <Chip
            key={t.valor}
            texto={t.rotulo}
            ativo={tipo === t.valor}
            aoTocar={() => setTipo(t.valor)}
          />
        ))}
      </View>
      {busca.isFetching && termo.length >= 2 ? <Carregando /> : null}
    </View>
  );

  const r = termo.length >= 2 ? busca.data : undefined;

  if (tipo === 'posts') {
    return (
      <FlatList
        style={estilos.fundo}
        contentContainerStyle={estilos.lista}
        data={r?.posts ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={busca.isFetching ? undefined : vazio}
        renderItem={({ item }) => <CartaoPost post={item} />}
        keyboardShouldPersistTaps="handled"
      />
    );
  }
  if (tipo === 'grupos') {
    return (
      <FlatList
        style={estilos.fundo}
        contentContainerStyle={estilos.lista}
        data={r?.grupos ?? []}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={busca.isFetching ? undefined : vazio}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={estilos.grupo}
            onPress={() =>
              router.push({ pathname: '/grupo/[id]', params: { id: item.id } })
            }
            accessibilityRole="button"
          >
            <Text style={estilos.nomeGrupo}>{item.nome}</Text>
            {item.disciplina ? (
              <Info icone="book-outline">{item.disciplina.nome}</Info>
            ) : null}
            <Info icone="people-outline">
              {item.membros}/{item.vagas} membros
            </Info>
          </Pressable>
        )}
      />
    );
  }
  return (
    <FlatList
      style={estilos.fundo}
      contentContainerStyle={estilos.lista}
      data={r?.pessoas ?? []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={busca.isFetching ? undefined : vazio}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <LinhaPessoa
          pessoa={item}
          detalhe={
            [item.curso?.nome, item.habilidades.slice(0, 3).join(', ')]
              .filter(Boolean)
              .join(' · ') || undefined
          }
        />
      )}
    />
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.g, gap: espaco.p },
  cabecalho: { gap: espaco.m, marginBottom: espaco.p },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingHorizontal: espaco.m,
  },
  entrada: { flex: 1, height: 44, fontSize: 16, color: cores.texto },
  chips: { flexDirection: 'row', gap: 6 },
  vazio: { alignItems: 'center', gap: espaco.p, padding: espaco.gg },
  centro: { textAlign: 'center' },
  grupo: {
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.m,
    gap: 4,
  },
  nomeGrupo: { fontSize: 16, fontWeight: '700', color: cores.texto },
});
