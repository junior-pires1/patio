import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import type { Grupo } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';

/** RF22/RF23: grupos de estudo da faculdade. */
export default function Grupos() {
  const estilos = useEstilos();
  const { api } = useSessao();
  const { c } = useTema();
  const [meus, setMeus] = useState(false);
  const grupos = useQuery({
    queryKey: ['grupos', meus],
    queryFn: () => api.get<Grupo[]>(`/grupos${meus ? '?meus=true' : ''}`),
  });

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.chips}>
        <Chip texto="Todos" ativo={!meus} aoTocar={() => setMeus(false)} />
        <Chip texto="Meus grupos" ativo={meus} aoTocar={() => setMeus(true)} />
      </View>
      <Botao
        titulo="Criar grupo"
        icone="add"
        variante="suave"
        compacto
        aoTocar={() => router.push('/grupos/novo')}
      />
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
            icone="people-outline"
            titulo={meus ? 'Você ainda não está em nenhum grupo' : 'Nenhum grupo ainda'}
            texto="Crie um grupo para a sua disciplina e chame os colegas."
          />
        )
      }
      renderItem={({ item }) => {
        const ocupacao = item.vagas > 0 ? Math.min(1, item.membros / item.vagas) : 0;
        return (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/grupo/[id]', params: { id: item.id } })
            }
            style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={estilos.linha}>
              <View style={estilos.icone}>
                <Text style={estilos.inicial}>
                  {item.nome.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.nome} numberOfLines={1}>
                  {item.nome}
                </Text>
                <Info icone="time-outline">
                  {[item.encontro, item.local].filter(Boolean).join(' · ') ||
                    'Horário a combinar'}
                </Info>
              </View>
              {item.naoLidas > 0 ? (
                <View style={estilos.bolinha}>
                  <Text style={estilos.bolinhaTexto}>{item.naoLidas}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
              )}
            </View>
            {item.disciplina ? (
              <View style={estilos.disciplina}>
                <Ionicons name="book-outline" size={13} color={c.marca} />
                <Text style={estilos.disciplinaTexto}>{item.disciplina.nome}</Text>
              </View>
            ) : null}
            {item.descricao ? (
              <Text style={estilos.texto} numberOfLines={2}>
                {item.descricao}
              </Text>
            ) : null}
            <View style={estilos.rodape}>
              <View style={estilos.trilho}>
                <View
                  style={[
                    estilos.preenchido,
                    { width: `${Math.round(ocupacao * 100)}%` },
                    item.vagasLivres === 0 && { backgroundColor: c.textoFraco },
                  ]}
                />
              </View>
              <Text style={estilos.meta}>
                {item.membros}/{item.vagas}{' '}
                {item.vagasLivres === 0
                  ? '· lotado'
                  : `· ${item.vagasLivres} ${item.vagasLivres === 1 ? 'vaga' : 'vagas'}`}
              </Text>
              {item.souMembro ? (
                <View style={estilos.participa}>
                  <Text style={estilos.participaTexto}>Você participa</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  flex: { flex: 1, gap: 2 },
  lista: {
    padding: espaco.g,
    paddingTop: espaco.p,
    gap: espaco.m,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', gap: 6 },
  cartao: {
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
    gap: espaco.m,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  icone: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: c.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { fontFamily: fonte.extra, fontSize: 19, color: c.marca },
  nome: { ...tipo.nome, fontSize: 16, color: c.texto },
  disciplina: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: raio.total,
    backgroundColor: c.marcaSuave,
  },
  disciplinaTexto: { fontSize: 12.5, fontFamily: fonte.semi, color: c.marca },
  texto: { ...tipo.corpo, fontSize: 14.5, color: c.textoSuave },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: espaco.p },
  trilho: {
    flex: 1,
    maxWidth: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.superficieAlta,
    overflow: 'hidden',
  },
  preenchido: { height: 6, borderRadius: 3, backgroundColor: c.marca },
  meta: { ...tipo.apoio, color: c.textoSuave },
  participa: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: raio.total,
    backgroundColor: c.sucessoSuave,
  },
  participaTexto: { fontSize: 11.5, fontFamily: fonte.negrito, color: c.sucesso },
  bolinha: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: c.marca,
  },
  bolinhaTexto: { color: c.sobreMarca, fontSize: 12, fontFamily: fonte.negrito },
}));
