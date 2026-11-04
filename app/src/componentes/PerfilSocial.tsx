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
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
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
type Aba = 'posts' | 'salvos' | 'sobre';

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
  const estilos = useEstilos();
  const { c } = useTema();
  const b = useBase();
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
  // Salvos: só a própria pessoa vê (aba extra no próprio perfil).
  const salvos = useInfiniteQuery({
    queryKey: ['salvos'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<Pagina>(
        `/eu/salvos${pageParam ? `?antes=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (u) => (u.temMais ? (u.posts.at(-1)?.criadoEm ?? null) : null),
    enabled: aba === 'salvos',
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
  const fonteDaGrade = aba === 'salvos' ? salvos : posts;
  const lista = fonteDaGrade.data?.pages.flatMap((x) => x.posts) ?? [];
  const links = LINKS.filter((l) => p.links?.[l.chave]);

  function abrirStories() {
    if (storiesDela)
      router.push({ pathname: '/stories/[autorId]', params: { autorId: usuarioId } });
    else if (souEu) router.push('/stories/novo');
  }

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.capa}>
        <View style={estilos.circuloCapa} />
        <View
          style={[estilos.faisca, { left: 26, top: 24, transform: [{ rotate: '-28deg' }] }]}
        />
        <View
          style={[
            estilos.faisca,
            { left: 50, top: 46, width: 12, transform: [{ rotate: '18deg' }] },
          ]}
        />
      </View>
      <View style={estilos.topo}>
        <Pressable
          onPress={abrirStories}
          accessibilityRole="button"
          accessibilityLabel={storiesDela ? 'Ver stories' : 'Foto de perfil'}
          style={[
            estilos.anel,
            {
              borderColor: storiesDela ? (temStoryNovo ? cor : c.borda) : c.fundo,
            },
          ]}
        >
          <Avatar nome={p.apelido} fotoUrl={p.fotoUrl} tamanho={92} />
          {souEu && !storiesDela ? (
            <View style={estilos.mais}>
              <Ionicons name="add" size={16} color={c.sobreDestaque} />
            </View>
          ) : null}
        </Pressable>
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
                style={({ pressed }) => [estilos.link, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name={l.icone} size={14} color={c.texto} />
                <Text style={estilos.linkTexto}>{l.rotulo}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

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
            <Text style={estilos.rotuloNumero} numberOfLines={1} adjustsFontSizeToFit>
              {rotulo}
            </Text>
          </View>
        ))}
      </View>

      <View style={estilos.acoes}>
        {souEu ? (
          <>
            <View style={estilos.flex}>
              <Botao
                titulo="Editar perfil"
                variante="suave"
                icone="create-outline"
                compacto
                aoTocar={() => router.push('/perfil/editar')}
              />
            </View>
            <View style={estilos.flex}>
              <Botao
                titulo="Atividade"
                variante="contorno"
                icone="heart-outline"
                compacto
                aoTocar={() => router.push('/atividade')}
              />
            </View>
          </>
        ) : p.relacao.conexaoId ? (
          <View style={estilos.flex}>
            <Botao
              titulo="Mensagem"
              icone="chatbubble-ellipses"
              compacto
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
              icone="heart"
              compacto
              carregando={descurtir.isPending}
              aoTocar={() => descurtir.mutate()}
            />
          </View>
        ) : (
          <View style={estilos.flex}>
            <Botao
              titulo={p.relacao.meCurtiu ? 'Curtir de volta' : 'Curtir'}
              icone="heart-outline"
              compacto
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
            <Ionicons name="flag-outline" size={20} color={c.textoSuave} />
          </Pressable>
        ) : null}
      </View>
      {!souEu && p.relacao.meCurtiu && !p.relacao.conexaoId ? (
        <View style={estilos.dica}>
          <Ionicons name="heart" size={14} color={c.sobreDestaque} />
          <Text style={estilos.dicaTexto}>Curtiu você. Curta de volta para conversar.</Text>
        </View>
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
                <View style={[estilos.capaDestaque, estilos.capaNova]}>
                  <Ionicons name="add" size={26} color={c.texto} />
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
                  style={estilos.capaDestaque}
                />
              ) : (
                <View style={estilos.capaDestaque} />
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
            ...(souEu ? ([['salvos', 'bookmark-outline', 'Salvos']] as const) : []),
            ['sobre', 'person-outline', 'Sobre'],
          ] as const
        ).map(([valor, icone, rotulo]) => (
          <Pressable
            key={valor}
            onPress={() => setAba(valor)}
            style={[estilos.aba, aba === valor && estilos.abaAtiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: aba === valor }}
            accessibilityLabel={rotulo}
          >
            <Ionicons
              name={icone}
              size={17}
              color={aba === valor ? c.texto : c.textoSuave}
            />
            <Text style={[estilos.abaTexto, aba === valor && estilos.abaTextoAtiva]}>
              {rotulo}
            </Text>
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
            <View style={[estilos.miniatura, estilos.soTexto]}>
              <Text style={estilos.textoMiniatura} numberOfLines={5}>
                {item.texto}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      ListEmptyComponent={
        fonteDaGrade.isPending ? (
          <Carregando />
        ) : (
          <View style={estilos.vazio}>
            <Ionicons name="images-outline" size={40} color={c.textoSuave} />
            <Text style={b.subtitulo}>
              {aba === 'salvos'
                ? 'Toque no marcador de uma publicação para guardar aqui.'
                : souEu
                  ? 'Você ainda não publicou nada.'
                  : 'Nenhuma publicação ainda.'}
            </Text>
          </View>
        )
      }
      onEndReached={() =>
        fonteDaGrade.hasNextPage &&
        !fonteDaGrade.isFetchingNextPage &&
        void fonteDaGrade.fetchNextPage()
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
  const estilos = useEstilos();
  const { c } = useTema();
  const b = useBase();
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
          <Text style={b.subtitulo}>
            {p.relacao.souEu
              ? 'Adicione estágios, projetos e monitorias em Editar perfil.'
              : 'Nenhuma experiência cadastrada.'}
          </Text>
        ) : (
          p.experiencias.map((e) => (
            <View key={e.id} style={estilos.experiencia}>
              <View style={estilos.marcador}>
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
            <Text style={b.subtitulo}>Toque para recomendar uma habilidade.</Text>
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
                    color={h.euRecomendei ? cor : c.textoSuave}
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
  const estilos = useEstilos();
  return (
    <View style={estilos.secao}>
      <Text style={estilos.tituloSecao}>{titulo}</Text>
      {children}
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  flex: { flex: 1 },
  cabecalho: { gap: espaco.m, paddingBottom: espaco.p },
  capa: { height: 112, backgroundColor: c.marca, overflow: 'hidden' },
  circuloCapa: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -50,
    top: -90,
    backgroundColor: c.marcaForte,
  },
  faisca: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.destaque,
  },
  topo: { paddingHorizontal: espaco.g, marginTop: -58 },
  anel: {
    alignSelf: 'flex-start',
    borderWidth: 3,
    borderRadius: 999,
    padding: 3,
    backgroundColor: c.fundo,
  },
  mais: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.destaque,
    borderWidth: 3,
    borderColor: c.fundo,
  },
  bio: { paddingHorizontal: espaco.g, gap: 2 },
  nome: { ...tipo.titulo, color: c.texto },
  curso: { ...tipo.apoio, fontSize: 14, color: c.textoSuave },
  frase: { ...tipo.corpo, color: c.texto, marginTop: 6 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: raio.total,
    backgroundColor: c.superficieAlta,
  },
  linkTexto: { fontSize: 13, fontFamily: fonte.semi, color: c.texto },
  numeros: {
    flexDirection: 'row',
    marginHorizontal: espaco.g,
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    paddingVertical: espaco.m,
  },
  numero: { flex: 1, alignItems: 'center', paddingHorizontal: 2, gap: 2 },
  valor: { fontSize: 20, fontFamily: fonte.extra, color: c.texto, letterSpacing: -0.4 },
  rotuloNumero: { fontFamily: fonte.medio, fontSize: 11.5, color: c.textoSuave },
  acoes: {
    flexDirection: 'row',
    gap: espaco.p,
    paddingHorizontal: espaco.g,
    alignItems: 'center',
  },
  menu: {
    width: 40,
    height: 40,
    borderRadius: raio.p + 2,
    borderWidth: 1.5,
    borderColor: c.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dica: {
    marginHorizontal: espaco.g,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: raio.m,
    backgroundColor: c.destaqueSuave,
  },
  dicaTexto: { fontSize: 13, fontFamily: fonte.semi, color: c.texto, flex: 1 },
  destaques: { paddingHorizontal: espaco.g, gap: espaco.m, paddingVertical: 4 },
  destaque: { alignItems: 'center', width: 70, gap: 6 },
  capaDestaque: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.superficieAlta,
    borderWidth: 2,
    borderColor: c.superficie,
  },
  capaNova: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderColor: c.textoFraco,
    backgroundColor: 'transparent',
  },
  tituloDestaque: { fontFamily: fonte.medio, fontSize: 12, color: c.texto },
  abas: {
    flexDirection: 'row',
    marginHorizontal: espaco.g,
    marginTop: espaco.p,
    padding: 4,
    gap: 4,
    borderRadius: raio.m,
    backgroundColor: c.superficieAlta,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: raio.p,
  },
  abaAtiva: { backgroundColor: c.superficie },
  abaTexto: { fontFamily: fonte.semi, fontSize: 13.5, color: c.textoSuave },
  abaTextoAtiva: { color: c.texto },
  colunas: { gap: 4, paddingHorizontal: espaco.g },
  celula: { flex: 1 / 3, marginBottom: 4 },
  miniatura: { width: '100%', aspectRatio: 1, borderRadius: raio.p + 2 },
  soTexto: {
    padding: 10,
    justifyContent: 'flex-end',
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
  },
  textoMiniatura: { fontFamily: fonte.semi, fontSize: 12, lineHeight: 16, color: c.texto },
  vazio: { alignItems: 'center', gap: espaco.p, padding: espaco.gg },
  sobre: { padding: espaco.g, gap: espaco.m },
  secao: {
    gap: espaco.p,
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.g,
  },
  tituloSecao: { ...tipo.secao, color: c.texto },
  paragrafo: { ...tipo.corpo, color: c.texto },
  experiencia: { flexDirection: 'row', gap: espaco.m, paddingVertical: 4 },
  marcador: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.marcaSuave,
  },
  tituloExperiencia: { ...tipo.nome, color: c.texto },
  meta: { ...tipo.apoio, color: c.textoSuave },
  habilidade: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: c.borda,
  },
  nomeHabilidade: { fontSize: 15, fontFamily: fonte.semi, color: c.texto },
  recomendacao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grupoDisciplinas: { gap: 2 },
  rotuloRelacao: { ...tipo.sobrescrito, color: c.textoSuave },
}));
