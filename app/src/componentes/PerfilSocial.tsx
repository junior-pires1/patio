import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  DestaqueResumo,
  HabilidadeRecomendada,
  Links,
  PerfilCompleto,
  Post,
  StoriesDaPessoa,
} from '@/api/tipos';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, estilosBase, raio, suave } from '@/tema';
import { alerta } from '@/utils/alerta';
import { mesAno } from '@/utils/datas';
import { enderecoDaFoto } from '@/utils/endereco';
import { OBJETIVOS, RELACOES, resumo, rotuloExperiencia } from '@/utils/opcoes';
import { useNotificar } from './Notificacoes';
import { Avatar } from './Avatar';
import { Botao } from './Botao';
import { Aviso, Carregando } from './Estados';
import { Info } from './Info';

type Pagina = { posts: Post[]; temMais: boolean };
type Aba = 'posts' | 'sobre';

const LINKS: {
  chave: keyof Links;
  rotulo: string;
  icone: 'logo-github' | 'logo-linkedin' | 'globe-outline' | 'school-outline';
}[] = [
  { chave: 'github', rotulo: 'GitHub', icone: 'logo-github' },
  { chave: 'linkedin', rotulo: 'LinkedIn', icone: 'logo-linkedin' },
  { chave: 'portfolio', rotulo: 'Portfólio', icone: 'globe-outline' },
  { chave: 'lattes', rotulo: 'Lattes', icone: 'school-outline' },
];

/**
 * Perfil estilo Instagram + LinkedIn: cabeçalho com foto (anel quando há
 * story), números, bio e links; destaques; abas Publicações (grade) e Sobre
 * (experiências, habilidades com recomendações, disciplinas, horários).
 */
export function PerfilSocial({ usuarioId }: { usuarioId: string }) {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const [aba, setAba] = useState<Aba>('posts');

  const perfil = useQuery({
    queryKey: ['perfil', usuarioId],
    queryFn: () => api.get<PerfilCompleto>(`/usuarios/${usuarioId}/perfil`),
  });
  const posts = useInfiniteQuery({
    queryKey: ['posts-do-usuario', usuarioId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<Pagina>(
        `/usuarios/${usuarioId}/posts${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (u) => (u.temMais ? (u.posts.at(-1)?.criadoEm ?? null) : null),
  });
  const destaques = useQuery({
    queryKey: ['destaques', usuarioId],
    queryFn: () => api.get<DestaqueResumo[]>(`/usuarios/${usuarioId}/destaques`),
  });
  const stories = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<StoriesDaPessoa[]>('/stories'),
  });

  const atualizarPerfil = () =>
    void queryClient.invalidateQueries({ queryKey: ['perfil', usuarioId] });

  const curtir = useMutation({
    mutationFn: () =>
      api.post<{ match: { id: string } | null }>('/curtidas', { paraId: usuarioId }),
    onSuccess: (r) => {
      atualizarPerfil();
      void queryClient.invalidateQueries({ queryKey: ['descobrir'] });
      if (r.match) {
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
        notificar({ titulo: 'Nova conexão!', texto: 'Agora vocês podem conversar.' });
      }
    },
    onError: (e) => alerta('Não foi possível curtir', e.message),
  });
  const descurtir = useMutation({
    mutationFn: () => api.delete(`/curtidas/${usuarioId}`),
    onSuccess: () => {
      atualizarPerfil();
      void queryClient.invalidateQueries({ queryKey: ['descobrir'] });
    },
    onError: (e) => alerta('Não foi possível desfazer', e.message),
  });
  const recomendar = useMutation({
    mutationFn: (h: HabilidadeRecomendada) =>
      h.euRecomendei
        ? api.delete(`/usuarios/${usuarioId}/recomendacoes`, { habilidade: h.habilidade })
        : api.put(`/usuarios/${usuarioId}/recomendacoes`, { habilidade: h.habilidade }),
    onSuccess: atualizarPerfil,
    onError: (e) => alerta('Recomendação', e.message),
  });

  if (perfil.isPending) return <Carregando />;
  if (perfil.isError) {
    return (
      <Aviso
        titulo="Perfil indisponível"
        texto={perfil.error.message}
        acao={{ titulo: 'Tentar de novo', aoTocar: () => void perfil.refetch() }}
      />
    );
  }
  const p = perfil.data;
  const souEu = p.relacao.souEu;
  const storiesDela = stories.data?.find((s) => s.autor.id === usuarioId);
  const temStoryNovo = storiesDela ? !storiesDela.todosVistos || souEu : false;
  const lista = posts.data?.pages.flatMap((x) => x.posts) ?? [];
  const links = LINKS.filter((l) => p.links?.[l.chave]);

  function abrirStories() {
    if (storiesDela)
      router.push({ pathname: '/stories/[autorId]', params: { autorId: usuarioId } });
    else if (souEu) router.push('/stories/novo');
  }

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.topo}>
        <Pressable
          onPress={abrirStories}
          accessibilityRole="button"
          accessibilityLabel={storiesDela ? 'Ver stories' : 'Foto de perfil'}
          style={[
            estilos.anel,
            {
              borderColor: storiesDela ? (temStoryNovo ? cor : cores.borda) : 'transparent',
            },
          ]}
        >
          <Avatar nome={p.apelido} fotoUrl={p.fotoUrl} tamanho={84} />
          {souEu && !storiesDela ? (
            <View style={[estilos.mais, { backgroundColor: cor }]}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={estilos.numeros}>
          {(
            [
              ['Publicações', p.contadores.publicacoes],
              ['Conexões', p.contadores.conexoes],
              ['Recomendações', p.contadores.recomendacoes],
            ] as const
          ).map(([rotulo, valor]) => (
            <View key={rotulo} style={estilos.numero}>
              <Text style={estilos.valor}>{valor}</Text>
              <Text style={estilos.rotuloNumero}>{rotulo}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={estilos.bio}>
        <Text style={estilos.nome}>{p.apelido}</Text>
        <Text style={estilos.curso}>{resumo(p)}</Text>
        {p.frase ? <Text style={estilos.frase}>{p.frase}</Text> : null}
        {links.length > 0 ? (
          <View style={estilos.links}>
            {links.map((l) => (
              <Pressable
                key={l.chave}
                onPress={() => void Linking.openURL(p.links[l.chave]!)}
                accessibilityRole="link"
                style={estilos.link}
              >
                <Ionicons name={l.icone} size={15} color={cor} />
                <Text style={[estilos.linkTexto, { color: cor }]}>{l.rotulo}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={estilos.acoes}>
        {souEu ? (
          <>
            <View style={estilos.flex}>
              <Botao
                titulo="Editar perfil"
                variante="contorno"
                aoTocar={() => router.push('/perfil/editar')}
              />
            </View>
            <View style={estilos.flex}>
              <Botao
                titulo="Atividade"
                variante="contorno"
                aoTocar={() => router.push('/atividade')}
              />
            </View>
          </>
        ) : p.relacao.conexaoId ? (
          <View style={estilos.flex}>
            <Botao
              titulo="Mensagem"
              aoTocar={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: p.relacao.conexaoId! },
                })
              }
            />
          </View>
        ) : p.relacao.euCurti ? (
          <View style={estilos.flex}>
            <Botao
              titulo="Curtido · desfazer"
              variante="contorno"
              carregando={descurtir.isPending}
              aoTocar={() => descurtir.mutate()}
            />
          </View>
        ) : (
          <View style={estilos.flex}>
            <Botao
              titulo={p.relacao.meCurtiu ? 'Curtir de volta' : 'Curtir'}
              carregando={curtir.isPending}
              aoTocar={() => curtir.mutate()}
            />
          </View>
        )}
        {!souEu ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/denunciar/[usuarioId]', params: { usuarioId } })
            }
            style={estilos.menu}
            accessibilityRole="button"
            accessibilityLabel="Denunciar ou bloquear"
          >
            <Ionicons name="flag-outline" size={20} color={cores.textoSuave} />
          </Pressable>
        ) : null}
      </View>
      {!souEu && p.relacao.meCurtiu && !p.relacao.conexaoId ? (
        <Text style={[estilos.dica, { color: cor }]}>
          Curtiu você. Curta de volta para conversar.
        </Text>
      ) : null}

      {(destaques.data?.length ?? 0) > 0 || souEu ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={destaques.data ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={estilos.destaques}
          ListHeaderComponent={
            souEu ? (
              <Pressable
                onPress={() => router.push('/destaques/novo')}
                style={estilos.destaque}
                accessibilityRole="button"
                accessibilityLabel="Novo destaque"
              >
                <View style={[estilos.capa, estilos.capaNova]}>
                  <Ionicons name="add" size={26} color={cores.texto} />
                </View>
                <Text style={estilos.tituloDestaque}>Novo</Text>
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/destaque/[id]', params: { id: item.id } })
              }
              style={estilos.destaque}
              accessibilityRole="button"
              accessibilityLabel={`Destaque ${item.titulo}`}
            >
              {item.capaUrl ? (
                <Image
                  source={{ uri: enderecoDaFoto(item.capaUrl)! }}
                  style={estilos.capa}
                />
              ) : (
                <View style={estilos.capa} />
              )}
              <Text style={estilos.tituloDestaque} numberOfLines={1}>
                {item.titulo}
              </Text>
            </Pressable>
          )}
        />
      ) : null}

      <View style={estilos.abas}>
        {(
          [
            ['posts', 'grid-outline', 'Publicações'],
            ['sobre', 'person-outline', 'Sobre'],
          ] as const
        ).map(([valor, icone, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setAba(valor)}
            style={[estilos.aba, aba === valor && { borderBottomColor: cor }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: aba === valor }}
            accessibilityLabel={rotulo}
          >
            <Ionicons
              name={icone}
              size={22}
              color={aba === valor ? cor : cores.textoSuave}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const atualizar = () => {
    void perfil.refetch();
    void posts.refetch();
    void destaques.refetch();
  };

  if (aba === 'sobre') {
    return (
      <ScrollView
        style={estilos.fundo}
        refreshControl={<RefreshControl refreshing={false} onRefresh={atualizar} />}
      >
        {cabecalho}
        <Sobre
          perfil={p}
          aoRecomendar={(h) => recomendar.mutate(h)}
          recomendando={recomendar.isPending}
        />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={estilos.fundo}
      data={lista}
      keyExtractor={(x) => x.id}
      numColumns={3}
      ListHeaderComponent={cabecalho}
      columnWrapperStyle={estilos.colunas}
      renderItem={({ item }) => (
        <Pressable
          style={estilos.celula}
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel="Abrir publicação"
        >
          {item.imagemUrl ? (
            <Image
              source={{ uri: enderecoDaFoto(item.imagemUrl)! }}
              style={estilos.miniatura}
            />
          ) : (
            <View
              style={[estilos.miniatura, estilos.soTexto, { backgroundColor: suave(cor) }]}
            >
              <Text style={estilos.textoMiniatura} numberOfLines={5}>
                {item.texto}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      ListEmptyComponent={
        posts.isPending ? (
          <Carregando />
        ) : (
          <View style={estilos.vazio}>
            <Ionicons name="images-outline" size={40} color={cores.textoSuave} />
            <Text style={estilosBase.subtitulo}>
              {souEu ? 'Você ainda não publicou nada.' : 'Nenhuma publicação ainda.'}
            </Text>
          </View>
        )
      }
      onEndReached={() =>
        posts.hasNextPage && !posts.isFetchingNextPage && void posts.fetchNextPage()
      }
      refreshControl={<RefreshControl refreshing={false} onRefresh={atualizar} />}
    />
  );
}

/** Aba Sobre: o lado LinkedIn do perfil. */
function Sobre({
  perfil: p,
  aoRecomendar,
  recomendando,
}: {
  perfil: PerfilCompleto;
  aoRecomendar: (h: HabilidadeRecomendada) => void;
  recomendando: boolean;
}) {
  const cor = useCorDaFaculdade();
  const podeRecomendar = !p.relacao.souEu && Boolean(p.relacao.conexaoId);
  const porRelacao = RELACOES.map((r) => ({
    ...r,
    itens: p.disciplinas.filter((d) => d.relacao === r.valor).map((d) => d.disciplina.nome),
  })).filter((r) => r.itens.length > 0);
  const objetivos = OBJETIVOS.filter((o) => p.objetivos.includes(o.valor)).map(
    (o) => o.rotulo,
  );

  return (
    <View style={estilos.sobre}>
      {p.sobre ? (
        <Secao titulo="Sobre">
          <Text style={estilos.paragrafo}>{p.sobre}</Text>
        </Secao>
      ) : null}

      <Secao titulo="Experiências">
        {p.experiencias.length === 0 ? (
          <Text style={estilosBase.subtitulo}>
            {p.relacao.souEu
              ? 'Adicione estágios, projetos e monitorias em Editar perfil.'
              : 'Nenhuma experiência cadastrada.'}
          </Text>
        ) : (
          p.experiencias.map((e) => (
            <View key={e.id} style={estilos.experiencia}>
              <View style={[estilos.marcador, { backgroundColor: suave(cor) }]}>
                <Ionicons name="briefcase-outline" size={18} color={cor} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.tituloExperiencia}>{e.titulo}</Text>
                <Text style={estilos.meta}>
                  {[rotuloExperiencia(e.tipo), e.organizacao].filter(Boolean).join(' · ')}
                </Text>
                <Text style={estilos.meta}>
                  {mesAno(e.inicio)} – {e.fim ? mesAno(e.fim) : 'atual'}
                </Text>
                {e.descricao ? <Text style={estilos.paragrafo}>{e.descricao}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Secao>

      {p.habilidadesRecomendadas.length > 0 ? (
        <Secao titulo="Habilidades">
          {podeRecomendar ? (
            <Text style={estilosBase.subtitulo}>Toque para recomendar uma habilidade.</Text>
          ) : null}
          {p.habilidadesRecomendadas.map((h) => (
            <Pressable
              key={h.habilidade}
              disabled={!podeRecomendar || recomendando}
              onPress={() => aoRecomendar(h)}
              style={estilos.habilidade}
              accessibilityRole={podeRecomendar ? 'button' : undefined}
              accessibilityState={{ checked: h.euRecomendei }}
            >
              <Text style={estilos.nomeHabilidade}>{h.habilidade}</Text>
              <View style={estilos.recomendacao}>
                {podeRecomendar ? (
                  <Ionicons
                    name={h.euRecomendei ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={16}
                    color={h.euRecomendei ? cor : cores.textoSuave}
                  />
                ) : null}
                <Text style={estilos.meta}>
                  {h.recomendacoes} recomendaç{h.recomendacoes === 1 ? 'ão' : 'ões'}
                </Text>
              </View>
            </Pressable>
          ))}
        </Secao>
      ) : null}

      {porRelacao.length > 0 ? (
        <Secao titulo="Disciplinas">
          {porRelacao.map((r) => (
            <View key={r.valor} style={estilos.grupoDisciplinas}>
              <Text style={estilos.rotuloRelacao}>{r.rotulo}</Text>
              <Text style={estilos.paragrafo}>{r.itens.join(', ')}</Text>
            </View>
          ))}
        </Secao>
      ) : null}

      {objetivos.length > 0 || p.interesses.length > 0 ? (
        <Secao titulo="Interesses">
          {objetivos.length > 0 ? (
            <Info icone="flag-outline">Procura: {objetivos.join(', ')}</Info>
          ) : null}
          {p.interesses.length > 0 ? (
            <Info icone="sparkles-outline">{p.interesses.join(', ')}</Info>
          ) : null}
          {p.horariosLivres.length > 0 ? (
            <Info icone="time-outline">Livre: {p.horariosLivres.join(', ')}</Info>
          ) : null}
        </Secao>
      ) : null}
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={estilos.secao}>
      <Text style={estilos.tituloSecao}>{titulo}</Text>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.superficie },
  flex: { flex: 1 },
  cabecalho: { gap: espaco.m, paddingTop: espaco.g },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espaco.g,
    gap: espaco.g,
  },
  anel: { borderWidth: 3, borderRadius: 999, padding: 3 },
  mais: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  numeros: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  numero: { alignItems: 'center' },
  valor: { fontSize: 18, fontWeight: '700', color: cores.texto },
  rotuloNumero: { fontSize: 12, color: cores.textoSuave },
  bio: { paddingHorizontal: espaco.g, gap: 2 },
  nome: { fontSize: 17, fontWeight: '700', color: cores.texto },
  curso: { fontSize: 14, color: cores.textoSuave },
  frase: { fontSize: 15, color: cores.texto, marginTop: 4, lineHeight: 21 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m, marginTop: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkTexto: { fontSize: 14, fontWeight: '600' },
  acoes: {
    flexDirection: 'row',
    gap: espaco.p,
    paddingHorizontal: espaco.g,
    alignItems: 'center',
  },
  menu: {
    width: 46,
    height: 46,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dica: { paddingHorizontal: espaco.g, fontSize: 13, fontWeight: '600' },
  destaques: { paddingHorizontal: espaco.g, gap: espaco.m },
  destaque: { alignItems: 'center', width: 68, gap: 4 },
  capa: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: cores.fundo,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  capaNova: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  tituloDestaque: { fontSize: 12, color: cores.texto },
  abas: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: cores.borda,
    marginTop: espaco.p,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  colunas: { gap: 2 },
  celula: { flex: 1 / 3, marginBottom: 2 },
  miniatura: { width: '100%', aspectRatio: 1 },
  soTexto: { padding: 8, justifyContent: 'center' },
  textoMiniatura: { fontSize: 12, color: cores.texto },
  vazio: { alignItems: 'center', gap: espaco.p, padding: espaco.gg },
  sobre: { padding: espaco.g, gap: espaco.g },
  secao: { gap: espaco.p },
  tituloSecao: { fontSize: 16, fontWeight: '700', color: cores.texto },
  paragrafo: { fontSize: 15, color: cores.texto, lineHeight: 21 },
  experiencia: { flexDirection: 'row', gap: espaco.m, paddingVertical: 4 },
  marcador: {
    width: 36,
    height: 36,
    borderRadius: raio.p,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloExperiencia: { fontSize: 15, fontWeight: '700', color: cores.texto },
  meta: { fontSize: 13, color: cores.textoSuave },
  habilidade: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: cores.borda,
  },
  nomeHabilidade: { fontSize: 15, fontWeight: '600', color: cores.texto },
  recomendacao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grupoDisciplinas: { gap: 2 },
  rotuloRelacao: { fontSize: 13, fontWeight: '700', color: cores.textoSuave },
});
