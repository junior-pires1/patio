import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { ResultadoBusca } from '@/api/tipos';
import { CartaoPost } from '@/componentes/CartaoPost';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';

type Tipo = 'pessoas' | 'posts' | 'grupos';
const TIPOS: { valor: Tipo; rotulo: string }[] = [
  { valor: 'pessoas', rotulo: 'Pessoas' },
  { valor: 'posts', rotulo: 'Publicações' },
  { valor: 'grupos', rotulo: 'Grupos' },
];

/** Busca de pessoas (apelido, curso, habilidade, disciplina), publicações e grupos. */
export default function Busca() {
  const estilos = useEstilos();
  const { c } = useTema();
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
      <Aviso
        icone={termo.length < 2 ? 'search-outline' : 'file-tray-outline'}
        titulo={termo.length < 2 ? 'O que você procura?' : 'Nada encontrado'}
        texto={
          termo.length < 2
            ? 'Busque por apelido, curso, habilidade (ex.: Python) ou disciplina.'
            : 'Tente outra palavra ou outro filtro.'
        }
      />
    </View>
  );

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.campo}>
        <Ionicons name="search" size={18} color={c.textoSuave} />
        <TextInput
          style={estilos.entrada}
          placeholder="Buscar na faculdade"
          placeholderTextColor={c.textoFraco}
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Buscar"
        />
        {texto ? (
          <Pressable onPress={() => setTexto('')} hitSlop={8} accessibilityLabel="Limpar">
            <Ionicons name="close-circle" size={18} color={c.textoSuave} />
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

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  lista: {
    padding: espaco.g,
    paddingTop: espaco.p,
    gap: espaco.p,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cabecalho: { gap: espaco.m, marginBottom: espaco.p },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    backgroundColor: c.superficieAlta,
    borderRadius: raio.m,
    paddingHorizontal: espaco.m + 2,
  },
  entrada: { flex: 1, height: 50, fontFamily: fonte.medio, fontSize: 16, color: c.texto },
  chips: { flexDirection: 'row', gap: 6 },
  vazio: { minHeight: 320 },
  centro: { textAlign: 'center' },
  grupo: {
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
    gap: 4,
  },
  nomeGrupo: { fontSize: 16, fontFamily: fonte.negrito, color: c.texto },
}));
