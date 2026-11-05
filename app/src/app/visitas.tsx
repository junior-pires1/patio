import { useQuery } from '@tanstack/react-query';
import { FlatList, Text, View } from 'react-native';
import type { Visitas } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos } from '@/tema-provedor';
import { quando } from '@/utils/datas';

const DIAS = 14;

/** Quem viu seu perfil (estilo LinkedIn): números, gráfico dos últimos dias e a lista. */
export default function TelaVisitas() {
  const s = useEstilos();
  const { api } = useSessao();
  const visitas = useQuery({
    queryKey: ['visitas'],
    queryFn: () => api.get<Visitas>('/eu/visitas'),
  });
  if (visitas.isPending) return <Carregando />;
  const v = visitas.data ?? { total: 0, pessoasDiferentes: 0, porDia: [], visitantes: [] };

  // Últimos 14 dias (contados a partir de quando os dados chegaram), com zero nos dias sem visita.
  const agora = visitas.dataUpdatedAt;
  const mapa = new Map(v.porDia.map((d) => [d.dia, d.total]));
  const dias = Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(agora - (DIAS - 1 - i) * 86_400_000);
    const chave = d.toISOString().slice(0, 10);
    return { chave, total: mapa.get(chave) ?? 0, rotulo: String(d.getUTCDate()) };
  });
  const maior = Math.max(1, ...dias.map((d) => d.total));

  return (
    <FlatList
      style={s.fundo}
      contentContainerStyle={s.conteudo}
      data={v.visitantes}
      keyExtractor={(x) => x.pessoa.id}
      ListHeaderComponent={
        <View style={s.topo}>
          <View style={s.numeros}>
            <View style={s.numero}>
              <Text style={s.valor}>{v.total}</Text>
              <Text style={s.rotulo}>visitas em 30 dias</Text>
            </View>
            <View style={s.numero}>
              <Text style={s.valor}>{v.pessoasDiferentes}</Text>
              <Text style={s.rotulo}>pessoas diferentes</Text>
            </View>
          </View>
          <View
            style={s.grafico}
            accessible
            accessibilityLabel={`Visitas por dia nos últimos ${DIAS} dias`}
          >
            <Text style={s.graficoTitulo}>Últimos {DIAS} dias</Text>
            <View style={s.barras}>
              {dias.map((d) => (
                <View key={d.chave} style={s.coluna}>
                  <View style={s.trilho}>
                    <View
                      style={[
                        s.barra,
                        {
                          height: `${Math.max(d.total ? 8 : 2, (d.total / maior) * 100)}%`,
                        },
                        d.total === 0 && s.barraVazia,
                      ]}
                    />
                  </View>
                  <Text style={s.dia}>{d.rotulo}</Text>
                </View>
              ))}
            </View>
          </View>
          {v.visitantes.length > 0 ? <Text style={s.secao}>Quem visitou</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <LinhaPessoa
          pessoa={item.pessoa}
          detalhe={`${quando(item.em)}${item.vezes > 1 ? ` · ${item.vezes} dias` : ''}`}
        />
      )}
      ListEmptyComponent={
        <Aviso
          icone="eye-outline"
          titulo="Ninguém visitou ainda"
          texto="Publique, entre em grupos e complete o perfil para chamar atenção."
        />
      }
    />
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    padding: espaco.g,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    flexGrow: 1,
  },
  topo: { gap: espaco.m, marginBottom: espaco.p },
  numeros: { flexDirection: 'row', gap: espaco.m },
  numero: {
    flex: 1,
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
    gap: 2,
  },
  valor: { fontFamily: fonte.extra, fontSize: 30, color: c.texto, letterSpacing: -0.8 },
  rotulo: { ...tipo.apoio, color: c.textoSuave },
  grafico: {
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
    gap: espaco.m,
  },
  graficoTitulo: { ...tipo.rotulo, color: c.textoSuave },
  barras: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 4 },
  coluna: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  trilho: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barra: { width: '100%', backgroundColor: c.marca, borderRadius: 4 },
  barraVazia: { backgroundColor: c.superficieAlta },
  dia: { fontFamily: fonte.medio, fontSize: 10, color: c.textoSuave },
  secao: { ...tipo.secao, color: c.texto, marginTop: espaco.p },
}));
