import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { TipoVaga, Vaga } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';
import { rotuloModalidade, STATUS_CANDIDATURA, tipoVaga, TIPOS_VAGA } from '@/utils/opcoes';

type Lado = 'abertas' | 'candidaturas' | 'minhas';
const LADOS: [Lado, string][] = [
  ['abertas', 'Abertas'],
  ['candidaturas', 'Minhas candidaturas'],
  ['minhas', 'Publicadas por mim'],
];

/** Vagas e oportunidades da faculdade (estilo LinkedIn Jobs). */
export default function Vagas() {
  const s = useEstilos();
  const { api } = useSessao();
  const [lado, setLado] = useState<Lado>('abertas');
  const [tipoFiltro, setTipo] = useState<TipoVaga | null>(null);

  const vagas = useQuery({
    queryKey: ['vagas', lado, tipoFiltro],
    queryFn: () => {
      const q = new URLSearchParams({ lado });
      if (tipoFiltro) q.set('tipo', tipoFiltro);
      return api.get<Vaga[]>(`/vagas?${q.toString()}`);
    },
  });

  return (
    <FlatList
      style={s.fundo}
      contentContainerStyle={s.conteudo}
      data={vagas.data ?? []}
      keyExtractor={(v) => v.id}
      refreshControl={
        <RefreshControl
          refreshing={vagas.isRefetching}
          onRefresh={() => void vagas.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={s.topo}>
          <View style={s.hero}>
            <View style={s.flex}>
              <Text style={s.heroTitulo}>Oportunidades</Text>
              <Text style={s.heroTexto}>
                Estágios, monitorias, iniciação científica e projetos da sua faculdade.
              </Text>
            </View>
            <Botao
              titulo="Publicar"
              icone="add"
              compacto
              aoTocar={() => router.push('/vagas/nova')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {LADOS.map(([valor, rotulo]) => (
              <Chip
                key={valor}
                texto={rotulo}
                ativo={lado === valor}
                aoTocar={() => setLado(valor)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            <Chip
              texto="Todos os tipos"
              ativo={!tipoFiltro}
              aoTocar={() => setTipo(null)}
              tom="marca"
            />
            {TIPOS_VAGA.map((t) => (
              <Chip
                key={t.valor}
                texto={t.rotulo}
                tom="marca"
                ativo={tipoFiltro === t.valor}
                aoTocar={() => setTipo(tipoFiltro === t.valor ? null : t.valor)}
              />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        vagas.isPending ? (
          <Carregando />
        ) : (
          <Aviso
            icone="briefcase-outline"
            titulo={
              lado === 'candidaturas'
                ? 'Você ainda não se candidatou'
                : lado === 'minhas'
                  ? 'Você ainda não publicou vagas'
                  : 'Nenhuma vaga aberta'
            }
            texto="Professores, laboratórios e colegas publicam oportunidades aqui."
          />
        )
      }
      renderItem={({ item }) => <CartaoVaga vaga={item} />}
    />
  );
}

/** Cartão de uma vaga na lista. */
function CartaoVaga({ vaga }: { vaga: Vaga }) {
  const s = useEstilos();
  const { c } = useTema();
  const t = tipoVaga(vaga.tipo);
  const status = vaga.minhaCandidatura?.status;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/vagas/[id]', params: { id: vaga.id } })}
      style={({ pressed }) => [s.cartao, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Vaga: ${vaga.titulo}`}
    >
      <View style={s.icone}>
        <Ionicons name={t.icone} size={22} color={c.marca} />
      </View>
      <View style={s.flex}>
        <Text style={s.titulo} numberOfLines={2}>
          {vaga.titulo}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {[vaga.organizacao ?? vaga.autor.apelido, rotuloModalidade(vaga.modalidade)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={s.etiquetas}>
          <Text style={s.etiqueta}>{t.rotulo}</Text>
          {vaga.autor.papel === 'COORDENACAO' ? (
            <Text style={[s.etiqueta, s.oficial]}>Oficial</Text>
          ) : null}
          {!vaga.aberta ? <Text style={[s.etiqueta, s.encerrada]}>Encerrada</Text> : null}
          {status ? (
            <Text style={[s.etiqueta, status === 'APROVADA' ? s.aprovada : s.oficial]}>
              {STATUS_CANDIDATURA[status]}
            </Text>
          ) : null}
          {vaga.candidatos !== null ? (
            <Text style={s.etiqueta}>
              {vaga.candidatos} {vaga.candidatos === 1 ? 'candidato' : 'candidatos'}
            </Text>
          ) : null}
        </View>
        <Text style={s.quando}>
          {vaga.prazo
            ? `Até ${vaga.prazo.slice(8, 10)}/${vaga.prazo.slice(5, 7)}`
            : `Publicada ${quando(vaga.criadoEm)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    padding: espaco.g,
    gap: espaco.m,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexGrow: 1,
  },
  flex: { flex: 1 },
  topo: { gap: espaco.m },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    backgroundColor: c.marcaSuave,
    borderRadius: raio.g,
    padding: espaco.g,
  },
  heroTitulo: { ...tipo.secao, color: c.texto },
  heroTexto: { ...tipo.apoio, color: c.textoSuave },
  chips: { gap: 8 },
  cartao: {
    flexDirection: 'row',
    gap: espaco.m,
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
  },
  icone: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: c.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...tipo.nome, fontSize: 16, color: c.texto },
  meta: { ...tipo.apoio, color: c.textoSuave, marginTop: 1 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  etiqueta: {
    fontFamily: fonte.semi,
    fontSize: 12,
    color: c.texto,
    backgroundColor: c.superficieAlta,
    borderRadius: raio.total,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  oficial: { backgroundColor: c.marcaSuave, color: c.marca },
  aprovada: { backgroundColor: c.sucessoSuave, color: c.sucesso },
  encerrada: { backgroundColor: c.erroSuave, color: c.erro },
  quando: { ...tipo.apoio, fontSize: 12, color: c.textoSuave, marginTop: 8 },
}));
