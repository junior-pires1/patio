import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Grupo } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, raio, suave } from '@/tema';

/** RF22/RF23: grupos de estudo da faculdade. */
export default function Grupos() {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const [meus, setMeus] = useState(false);
  const grupos = useQuery({
    queryKey: ['grupos', meus],
    queryFn: () => api.get<Grupo[]>(`/grupos${meus ? '?meus=true' : ''}`),
  });

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <Botao titulo="➕  Criar grupo" aoTocar={() => router.push('/grupos/novo')} />
      <View style={estilos.chips}>
        <Chip texto="Todos" ativo={!meus} aoTocar={() => setMeus(false)} />
        <Chip texto="Meus grupos" ativo={meus} aoTocar={() => setMeus(true)} />
      </View>
    </View>
  );

  return (
    <FlatList
      style={estilos.fundo}
      contentContainerStyle={estilos.lista}
      data={grupos.data ?? []}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={cabecalho}
      refreshControl={
        <RefreshControl
          refreshing={grupos.isRefetching}
          onRefresh={() => void grupos.refetch()}
        />
      }
      ListEmptyComponent={
        grupos.isPending ? (
          <Carregando />
        ) : (
          <Aviso
            titulo={meus ? 'Você ainda não está em nenhum grupo' : 'Nenhum grupo ainda'}
            texto="Crie um grupo para a sua disciplina e chame os colegas."
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/grupo/[id]', params: { id: item.id } })}
          style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <View style={estilos.linha}>
            <Text style={estilos.nome}>{item.nome}</Text>
            {item.naoLidas > 0 ? (
              <View style={[estilos.bolinha, { backgroundColor: cor }]}>
                <Text style={estilos.bolinhaTexto}>{item.naoLidas}</Text>
              </View>
            ) : null}
          </View>
          {item.disciplina ? (
            <Text style={[estilos.disciplina, { color: cor, backgroundColor: suave(cor) }]}>
              {item.disciplina.nome}
            </Text>
          ) : null}
          {item.descricao ? (
            <Text style={estilos.texto} numberOfLines={2}>
              {item.descricao}
            </Text>
          ) : null}
          <Text style={estilos.meta}>
            {[item.encontro, item.local].filter(Boolean).join(' · ') ||
              'Horário a combinar'}
          </Text>
          <Text style={estilos.meta}>
            👥 {item.membros}/{item.vagas}{' '}
            {item.vagasLivres === 0 ? '· lotado' : `· ${item.vagasLivres} vaga(s)`}
            {item.souMembro ? ' · você participa' : ''}
          </Text>
        </Pressable>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.g, gap: espaco.m },
  cabecalho: { gap: espaco.m },
  chips: { flexDirection: 'row', gap: 6 },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: 6,
  },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { fontSize: 17, fontWeight: '700', color: cores.texto, flex: 1 },
  disciplina: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  texto: { fontSize: 15, color: cores.texto },
  meta: { fontSize: 13, color: cores.textoSuave },
  bolinha: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bolinhaTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
