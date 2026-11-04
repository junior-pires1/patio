import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useReducer, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PessoaResumo, Story } from '@/api/tipos';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';
import { enderecoDaFoto } from '@/utils/endereco';
import { Avatar } from './Avatar';

export const DURACAO_MS = 5000;
const PASSO_MS = 100;

type Props = {
  autor: PessoaResumo;
  stories: Story[];
  /** Começa no primeiro story não visto. */
  inicio?: number;
  meu: boolean;
  aoVer?: (story: Story) => void;
  aoTerminar: () => void;
  aoFechar: () => void;
  /** Só para o autor: lista de quem viu, apagar e mandar para destaque. */
  acoesDoAutor?: {
    quemViu: (story: Story) => Promise<{ pessoa: PessoaResumo; vistoEm: string }[]>;
    apagar: (story: Story) => void;
    paraDestaque?: () => void;
  };
  titulo?: string;
};

/**
 * Tela cheia de stories: barras de progresso, 5 s por story, toque à
 * direita avança e à esquerda volta, segurar pausa.
 */
export function VisualizadorStories({
  autor,
  stories,
  inicio = 0,
  meu,
  aoVer,
  aoTerminar,
  aoFechar,
  acoesDoAutor,
  titulo,
}: Props) {
  const estilos = useEstilos();
  const { c } = useTema();
  const total = stories.length;
  const [{ indice, progresso, terminou }, mover] = useReducer(
    (
      e: { indice: number; progresso: number; terminou: boolean },
      acao: { tipo: 'tique' } | { tipo: 'pular'; passo: number },
    ) => {
      if (e.terminou) return e;
      if (acao.tipo === 'tique') {
        const progresso = e.progresso + PASSO_MS / DURACAO_MS;
        if (progresso < 1) return { ...e, progresso };
        return e.indice < total - 1
          ? { indice: e.indice + 1, progresso: 0, terminou: false }
          : { ...e, progresso: 1, terminou: true };
      }
      const proximo = e.indice + acao.passo;
      if (proximo < 0) return { ...e, progresso: 0 };
      if (proximo >= total) return { ...e, terminou: true };
      return { indice: proximo, progresso: 0, terminou: false };
    },
    { indice: Math.min(inicio, Math.max(0, total - 1)), progresso: 0, terminou: false },
  );
  const [pausado, setPausado] = useState(false);
  const [vistos, setVistos] = useState<{ pessoa: PessoaResumo; vistoEm: string }[] | null>(
    null,
  );
  const atual = stories[indice];
  const avisado = useRef(new Set<string>());

  useEffect(() => {
    if (!atual || avisado.current.has(atual.id)) return;
    avisado.current.add(atual.id);
    aoVer?.(atual);
  }, [atual, aoVer]);

  useEffect(() => {
    if (pausado || vistos) return;
    const relogio = setInterval(() => mover({ tipo: 'tique' }), PASSO_MS);
    return () => clearInterval(relogio);
  }, [pausado, vistos]);

  useEffect(() => {
    if (terminou) aoTerminar();
  }, [terminou, aoTerminar]);

  if (!atual) return null;

  const ir = (passo: number) => mover({ tipo: 'pular', passo });

  return (
    <View style={estilos.fundo}>
      <Image
        source={{ uri: enderecoDaFoto(atual.imagemUrl)! }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <SafeAreaView style={estilos.camada} edges={['top', 'bottom']}>
        <View style={estilos.barras}>
          {stories.map((s, i) => (
            <View key={s.id} style={estilos.barra}>
              <View
                style={[
                  estilos.preenchido,
                  {
                    width: `${i < indice ? 100 : i === indice ? Math.min(progresso, 1) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={estilos.topo}>
          <Avatar nome={autor.apelido} fotoUrl={autor.fotoUrl} tamanho={34} />
          <View style={estilos.flex}>
            <Text style={estilos.nome}>
              {titulo ?? (meu ? 'Seu story' : autor.apelido)}
            </Text>
            <Text style={estilos.hora}>{quando(atual.criadoEm)}</Text>
          </View>
          <Pressable onPress={aoFechar} hitSlop={12} accessibilityLabel="Fechar stories">
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>

        <View style={estilos.toques}>
          <Pressable
            style={estilos.flex}
            onPress={() => ir(-1)}
            onLongPress={() => setPausado(true)}
            onPressOut={() => setPausado(false)}
            accessibilityLabel="Story anterior"
          />
          <Pressable
            style={estilos.flex2}
            onPress={() => ir(1)}
            onLongPress={() => setPausado(true)}
            onPressOut={() => setPausado(false)}
            accessibilityLabel="Próximo story"
          />
        </View>

        {atual.legenda ? <Text style={estilos.legenda}>{atual.legenda}</Text> : null}

        {acoesDoAutor ? (
          <View style={estilos.rodape}>
            <Pressable
              style={estilos.acao}
              onPress={async () => setVistos(await acoesDoAutor.quemViu(atual))}
              accessibilityRole="button"
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={estilos.acaoTexto}>Quem viu</Text>
            </Pressable>
            {acoesDoAutor.paraDestaque ? (
              <Pressable
                style={estilos.acao}
                onPress={acoesDoAutor.paraDestaque}
                accessibilityRole="button"
              >
                <Ionicons name="bookmark-outline" size={20} color="#fff" />
                <Text style={estilos.acaoTexto}>Destacar</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={estilos.acao}
              onPress={() => acoesDoAutor.apagar(atual)}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={estilos.acaoTexto}>Apagar</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={vistos !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setVistos(null)}
      >
        <View style={estilos.folhaFundo}>
          <View style={estilos.folha}>
            <View style={estilos.folhaTopo}>
              <Text style={estilos.folhaTitulo}>Visto por {vistos?.length ?? 0}</Text>
              <Pressable
                onPress={() => setVistos(null)}
                hitSlop={10}
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={24} color={c.texto} />
              </Pressable>
            </View>
            <FlatList
              data={vistos ?? []}
              keyExtractor={(v) => v.pessoa.id}
              ListEmptyComponent={<Text style={estilos.vazio}>Ninguém viu ainda.</Text>}
              renderItem={({ item }) => (
                <View style={estilos.pessoa}>
                  <Avatar
                    nome={item.pessoa.apelido}
                    fotoUrl={item.pessoa.fotoUrl}
                    tamanho={36}
                  />
                  <Text style={estilos.nomePessoa}>{item.pessoa.apelido}</Text>
                  <Text style={estilos.quando}>{quando(item.vistoEm)}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: '#000' },
  camada: { flex: 1 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  barras: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: espaco.p,
    paddingTop: espaco.p,
  },
  barra: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  preenchido: { height: 3, backgroundColor: '#fff' },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    padding: espaco.m,
  },
  nome: { color: '#fff', fontFamily: fonte.negrito, fontSize: 15 },
  hora: { color: 'rgba(255,255,255,0.8)', fontFamily: fonte.regular, fontSize: 12 },
  toques: { flex: 1, flexDirection: 'row' },
  legenda: {
    color: '#fff',
    fontFamily: fonte.regular,
    fontSize: 16,
    textAlign: 'center',
    padding: espaco.g,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: espaco.m,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  acao: { alignItems: 'center', gap: 2, minWidth: 70 },
  acaoTexto: { color: '#fff', fontFamily: fonte.regular, fontSize: 12 },
  folhaFundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  folha: {
    backgroundColor: c.superficie,
    borderTopLeftRadius: raio.g,
    borderTopRightRadius: raio.g,
    maxHeight: '60%',
    padding: espaco.g,
  },
  folhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: espaco.m,
  },
  folhaTitulo: { fontSize: 16, fontFamily: fonte.negrito, color: c.texto },
  vazio: { color: c.textoSuave, textAlign: 'center', padding: espaco.g },
  pessoa: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingVertical: 6 },
  nomePessoa: { flex: 1, fontFamily: fonte.regular, fontSize: 15, color: c.texto },
  quando: { fontFamily: fonte.regular, fontSize: 12, color: c.textoSuave },
}));
