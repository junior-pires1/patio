import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Conexao, Mensagem, Reacao } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Imagem } from '@/componentes/Imagem';
import { PostNaMensagem } from '@/componentes/PostNaMensagem';
import { GravadorDeVoz } from '@/componentes/chat/GravadorDeVoz';
import { MenuMensagem } from '@/componentes/chat/MenuMensagem';
import { PlayerDeAudio } from '@/componentes/chat/PlayerDeAudio';
import { reacaoDe } from '@/componentes/chat/reacoes';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { quando } from '@/utils/datas';
import { alerta } from '@/utils/alerta';
import { escolherImagem } from '@/utils/foto';
import { voltar } from '@/utils/navegacao';
import { useMensagensAntigas } from '@/utils/mensagensAntigas';

type Pagina = { mensagens: Mensagem[]; temMais: boolean };

export default function Chat() {
  const estilos = useEstilos();
  const { c } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);
  const [menu, setMenu] = useState<Mensagem | null>(null);
  const [gravando, setGravando] = useState(false);
  // Mensagens que mudaram (reação, apagada) também nas páginas antigas.
  const alteradas = useQuery({
    queryKey: ['mensagens-alteradas', id],
    queryFn: () => ({}) as Record<string, Mensagem>,
    initialData: {} as Record<string, Mensagem>,
    staleTime: Infinity,
  });
  // "Digitando…" da outra pessoa: hora do último aviso.
  const digitandoEm = useQuery({
    queryKey: ['digitando', id],
    queryFn: () => 0,
    initialData: 0,
    staleTime: Infinity,
  });
  // O aviso vale por 4 segundos; depois disso o "digitando…" some.
  const [expirado, setExpirado] = useState(0);
  useEffect(() => {
    const aviso = digitandoEm.data;
    if (!aviso) return;
    const t = setTimeout(() => setExpirado(aviso), 4000);
    return () => clearTimeout(t);
  }, [digitandoEm.data]);
  const outroDigitando = digitandoEm.data > 0 && expirado !== digitandoEm.data;
  const ultimoAviso = useRef(0);
  function mudarTexto(t: string) {
    setTexto(t);
    // Avisa no máximo a cada 3 segundos enquanto digita.
    if (t.trim() && Date.now() - ultimoAviso.current > 3000) {
      ultimoAviso.current = Date.now();
      api.post(`/matches/${id}/digitando`).catch(() => undefined);
    }
  }

  const conexao = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get<Conexao[]>('/matches'),
    select: (lista) => lista.find((c) => c.id === id),
  });
  const mensagens = useQuery({
    queryKey: ['mensagens', id],
    queryFn: () => api.get<Pagina>(`/matches/${id}/mensagens`),
  });
  const antigas = useMensagensAntigas(`/matches/${id}/mensagens`, mensagens.data);

  const enviar = useMutation({
    mutationFn: async ({
      t,
      imagem,
      audio,
    }: {
      t: string;
      imagem?: Blob;
      audio?: { uri: string; duracaoMs: number };
    }) => {
      const enviada = imagem ? await api.enviarImagem(imagem) : null;
      const gravado = audio
        ? await api.enviarAudio(await (await fetch(audio.uri)).blob(), audio.duracaoMs)
        : null;
      return api.post<Mensagem>(`/matches/${id}/mensagens`, {
        texto: t,
        ...(enviada ? { imagemId: enviada.id } : {}),
        ...(gravado ? { audioId: gravado.id } : {}),
        ...(respondendo ? { respostaId: respondendo.id } : {}),
      });
    },
    onSuccess: (nova) => {
      setTexto('');
      setRespondendo(null);
      queryClient.setQueryData<Pagina>(['mensagens', id], (p) =>
        p && !p.mensagens.some((m) => m.id === nova.id)
          ? { ...p, mensagens: [...p.mensagens, nova] }
          : p,
      );
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (e) => alerta('Mensagem não enviada', e.message),
  });

  function trocarMensagem(m: Mensagem) {
    queryClient.setQueryData<Record<string, Mensagem>>(
      ['mensagens-alteradas', id],
      (a) => ({
        ...a,
        [m.id]: m,
      }),
    );
  }
  const reagir = useMutation({
    mutationFn: ({ m, r }: { m: Mensagem; r: Reacao | null }) =>
      r
        ? api.put<Mensagem>(`/mensagens/${m.id}/reacao`, { reacao: r })
        : api.delete(`/mensagens/${m.id}/reacao`).then(() => null),
    onMutate: ({ m, r }) =>
      trocarMensagem({
        ...m,
        reacoes: [
          ...m.reacoes.filter((x) => x.usuarioId !== eu.id),
          ...(r ? [{ usuarioId: eu.id, reacao: r }] : []),
        ],
      }),
    onError: (e) => alerta('Reação não enviada', e.message),
  });
  const apagar = useMutation({
    mutationFn: (m: Mensagem) => api.delete(`/mensagens/${m.id}`),
    onMutate: (m) =>
      trocarMensagem({
        ...m,
        apagada: true,
        texto: '',
        imagemUrl: null,
        audio: null,
        post: null,
        reacoes: [],
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['matches'] }),
    onError: (e) => alerta('Não foi possível apagar', e.message),
  });

  // A imagem vai na hora, com o texto digitado (se houver) como legenda.
  async function mandarImagem() {
    try {
      const escolhida = await escolherImagem();
      if (escolhida) enviar.mutate({ t: texto.trim(), imagem: escolhida.blob });
    } catch {
      alerta('Imagem não enviada', 'Não foi possível abrir a imagem.');
    }
  }

  const pessoa = conexao.data?.pessoa;

  async function desfazer() {
    await api.delete(`/matches/${id}`);
    void queryClient.invalidateQueries({ queryKey: ['matches'] });
    voltar('/conexoes');
  }
  async function bloquear() {
    if (!pessoa) return;
    await api.post('/bloqueios', { usuarioId: pessoa.id });
    void queryClient.invalidateQueries({ queryKey: ['matches'] });
    voltar('/conexoes');
  }

  function abrirOpcoes() {
    if (!pessoa) return;
    const opcoes = ['Desfazer conexão', 'Bloquear', 'Denunciar', 'Cancelar'] as const;
    const escolher = (i: number) => {
      const confirmar = (titulo: string, texto: string, acao: () => Promise<void>) =>
        alerta(titulo, texto, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', style: 'destructive', onPress: () => void acao() },
        ]);
      if (i === 0)
        confirmar(
          'Desfazer conexão?',
          `A conversa com ${pessoa.apelido} será encerrada.`,
          desfazer,
        );
      if (i === 1)
        confirmar(
          `Bloquear ${pessoa.apelido}?`,
          'Vocês deixam de se ver no Pátio. A pessoa não é avisada.',
          bloquear,
        );
      if (i === 2)
        router.push({
          pathname: '/denunciar/[usuarioId]',
          params: { usuarioId: pessoa.id, apelido: pessoa.apelido },
        });
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...opcoes], cancelButtonIndex: 3, destructiveButtonIndex: [0, 1, 2] },
        escolher,
      );
    } else {
      alerta(pessoa.apelido, undefined, [
        { text: 'Desfazer conexão', onPress: () => escolher(0) },
        { text: 'Bloquear', onPress: () => escolher(1) },
        { text: 'Denunciar', onPress: () => escolher(2) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }

  const cabecalho = (
    <Stack.Screen
      options={{
        title: pessoa?.apelido ?? 'Conversa',
        // Tocar no nome abre o perfil da pessoa.
        headerTitle: () => (
          <Pressable
            onPress={() =>
              pessoa &&
              router.push({ pathname: '/usuario/[id]', params: { id: pessoa.id } })
            }
            accessibilityRole="button"
            accessibilityLabel="Ver perfil"
            style={estilos.tituloCabecalho}
          >
            <Avatar nome={pessoa?.apelido ?? '?'} fotoUrl={pessoa?.fotoUrl} tamanho={30} />
            <Text style={estilos.tituloTexto}>{pessoa?.apelido ?? 'Conversa'}</Text>
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            onPress={abrirOpcoes}
            hitSlop={12}
            accessibilityLabel="Opções da conversa"
          >
            <Ionicons name="ellipsis-vertical" size={22} color={c.texto} />
          </Pressable>
        ),
      }}
    />
  );

  if (mensagens.isPending)
    return (
      <>
        {cabecalho}
        <Carregando />
      </>
    );
  if (mensagens.isError) {
    return (
      <>
        {cabecalho}
        <Aviso
          titulo="Conversa indisponível"
          texto={mensagens.error.message}
          acao={{ titulo: 'Voltar', aoTocar: () => voltar('/conexoes') }}
        />
      </>
    );
  }

  const contatos = pessoa?.contatos ?? {};
  const listaContatos = [
    contatos.instagram && `Instagram ${contatos.instagram}`,
    contatos.whatsapp && `WhatsApp ${contatos.whatsapp}`,
  ].filter(Boolean);
  const lista = [...antigas.todas].reverse().map((m) => alteradas.data[m.id] ?? m);
  const nomeDe = (autorId: string) =>
    autorId === eu.id ? 'Você' : (pessoa?.apelido ?? '');
  const temTexto = texto.trim().length > 0;

  return (
    <SafeAreaView style={estilos.fundo} edges={['bottom', 'left', 'right']}>
      {cabecalho}
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {listaContatos.length > 0 ? (
          <Text style={estilos.contatos}>{listaContatos.join('  ·  ')}</Text>
        ) : null}
        <FlatList
          inverted
          data={lista}
          onEndReached={() => void antigas.carregar()}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            outroDigitando ? (
              <View style={[estilos.balao, estilos.dele, estilos.digitando]}>
                <Text style={estilos.digitandoTexto}>
                  {pessoa?.apelido ?? ''} está digitando…
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            antigas.carregando ? (
              <Text style={estilos.carregando}>Carregando…</Text>
            ) : undefined
          }
          keyExtractor={(m) => m.id}
          contentContainerStyle={estilos.lista}
          ListEmptyComponent={<Text style={estilos.vazio}>Comece a conversa</Text>}
          renderItem={({ item }) => {
            const minha = item.autorId === eu.id;
            const corTexto = minha ? c.sobreMarca : c.texto;
            const contagem = new Map<Reacao, number>();
            for (const r of item.reacoes)
              contagem.set(r.reacao, (contagem.get(r.reacao) ?? 0) + 1);
            return (
              <View style={[estilos.linha, minha ? estilos.linhaMinha : null]}>
                <Pressable
                  onLongPress={() => !item.apagada && setMenu(item)}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityHint="Segure para reagir ou responder"
                  accessibilityActions={[{ name: 'activate', label: 'Opções da mensagem' }]}
                  onAccessibilityAction={() => !item.apagada && setMenu(item)}
                  style={[
                    estilos.balao,
                    minha ? estilos.minha : estilos.dele,
                    item.apagada && estilos.apagada,
                  ]}
                >
                  {item.apagada ? (
                    <View style={estilos.linhaApagada}>
                      <Ionicons name="ban-outline" size={14} color={c.textoSuave} />
                      <Text style={estilos.textoApagado}>Mensagem apagada</Text>
                    </View>
                  ) : (
                    <>
                      {item.resposta ? (
                        <View
                          style={[
                            estilos.citacao,
                            minha ? estilos.citacaoMinha : estilos.citacaoDele,
                          ]}
                        >
                          <Text style={[estilos.citacaoNome, { color: corTexto }]}>
                            {nomeDe(item.resposta.autorId)}
                          </Text>
                          <Text
                            style={[estilos.citacaoTexto, { color: corTexto }]}
                            numberOfLines={2}
                          >
                            {item.resposta.resumo}
                          </Text>
                        </View>
                      ) : null}
                      {item.imagemUrl ? (
                        <Imagem url={item.imagemUrl} style={estilos.foto} />
                      ) : null}
                      {item.post ? <PostNaMensagem post={item.post} /> : null}
                      {item.audio ? (
                        <PlayerDeAudio
                          url={item.audio.url}
                          duracaoMs={item.audio.duracaoMs}
                          cor={corTexto}
                          corFraca={minha ? 'rgba(255,255,255,0.25)' : c.superficieAlta}
                        />
                      ) : null}
                      {item.texto ? (
                        <Text style={[estilos.texto, minha && estilos.textoMinha]}>
                          {item.texto}
                        </Text>
                      ) : null}
                    </>
                  )}
                  <Text style={[estilos.hora, minha && !item.apagada && estilos.horaMinha]}>
                    {quando(item.criadoEm)}
                    {minha && item.lidaEm ? ' · lida' : ''}
                  </Text>
                </Pressable>
                {contagem.size > 0 ? (
                  <Pressable
                    onPress={() => setMenu(item)}
                    style={[estilos.reacoes, minha ? estilos.reacoesMinha : null]}
                    accessibilityRole="button"
                    accessibilityLabel={`Reações: ${[...contagem.entries()]
                      .map(([r, n]) => `${reacaoDe(r).rotulo} ${n}`)
                      .join(', ')}`}
                  >
                    {[...contagem.entries()].map(([r, n]) => (
                      <View key={r} style={estilos.reacao}>
                        <Ionicons
                          name={reacaoDe(r).icone}
                          size={13}
                          color={reacaoDe(r).cor(c)}
                        />
                        {n > 1 ? <Text style={estilos.reacaoConta}>{n}</Text> : null}
                      </View>
                    ))}
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
        {respondendo ? (
          <View style={estilos.respondendo}>
            <View style={estilos.respondendoBarra} />
            <View style={estilos.flex}>
              <Text style={estilos.respondendoNome}>
                Respondendo{' '}
                {respondendo.autorId === eu.id ? 'a você' : `a ${pessoa?.apelido ?? ''}`}
              </Text>
              <Text style={estilos.respondendoTexto} numberOfLines={1}>
                {respondendo.texto ||
                  (respondendo.audio
                    ? 'Mensagem de voz'
                    : respondendo.imagemUrl
                      ? 'Foto'
                      : 'Publicação')}
              </Text>
            </View>
            <Pressable
              onPress={() => setRespondendo(null)}
              hitSlop={10}
              accessibilityLabel="Cancelar resposta"
            >
              <Ionicons name="close" size={20} color={c.textoSuave} />
            </Pressable>
          </View>
        ) : null}
        {gravando ? (
          <GravadorDeVoz
            aoCancelar={() => setGravando(false)}
            aoEnviar={(audio) => {
              setGravando(false);
              enviar.mutate({ t: '', audio });
            }}
          />
        ) : (
          <View style={estilos.barra}>
            <Pressable
              onPress={() => void mandarImagem()}
              disabled={enviar.isPending}
              style={estilos.anexo}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Enviar imagem"
            >
              <Ionicons name="image-outline" size={24} color={c.textoSuave} />
            </Pressable>
            <TextInput
              style={estilos.entrada}
              placeholder="Mensagem"
              placeholderTextColor={c.textoFraco}
              multiline
              maxLength={1000}
              value={texto}
              onChangeText={mudarTexto}
              accessibilityLabel="Mensagem"
            />
            {temTexto ? (
              <Pressable
                onPress={() => enviar.mutate({ t: texto.trim() })}
                disabled={enviar.isPending}
                style={[estilos.enviar, { opacity: enviar.isPending ? 0.5 : 1 }]}
                accessibilityLabel="Enviar"
              >
                <Ionicons name="arrow-up" size={20} color={c.sobreMarca} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setGravando(true)}
                disabled={enviar.isPending}
                style={[estilos.enviar, estilos.microfone]}
                accessibilityRole="button"
                accessibilityLabel="Gravar mensagem de voz"
              >
                <Ionicons name="mic" size={20} color={c.marca} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      <MenuMensagem
        mensagem={menu}
        minha={menu?.autorId === eu.id}
        minhaReacao={menu?.reacoes.find((r) => r.usuarioId === eu.id)?.reacao ?? null}
        aoFechar={() => setMenu(null)}
        aoReagir={(r) => {
          if (menu) reagir.mutate({ m: menu, r });
          setMenu(null);
        }}
        aoResponder={() => {
          setRespondendo(menu);
          setMenu(null);
        }}
        aoApagar={() => {
          const alvo = menu;
          setMenu(null);
          if (!alvo) return;
          alerta('Apagar para todos?', 'A mensagem some para você e para a outra pessoa.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => apagar.mutate(alvo) },
          ]);
        }}
      />
    </SafeAreaView>
  );
}

const useEstilos = criarEstilos((c) => ({
  carregando: {
    textAlign: 'center',
    color: c.textoSuave,
    padding: espaco.p,
  },
  fundo: { flex: 1, backgroundColor: c.fundo },
  tituloCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tituloTexto: { fontSize: 17, fontFamily: fonte.negrito, color: c.texto },
  contatos: {
    textAlign: 'center',
    fontFamily: fonte.regular,
    fontSize: 13,
    color: c.textoSuave,
    padding: espaco.p,
    backgroundColor: c.superficie,
  },
  lista: { padding: espaco.m, gap: 6, flexGrow: 1 },
  vazio: {
    textAlign: 'center',
    color: c.textoSuave,
    marginTop: 24,
    transform: [{ scaleY: -1 }],
  },
  balao: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  minha: { alignSelf: 'flex-end', borderBottomRightRadius: 6, backgroundColor: c.marca },
  linha: { alignItems: 'flex-start', marginBottom: 2 },
  linhaMinha: { alignItems: 'flex-end' },
  flex: { flex: 1 },
  apagada: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.borda },
  linhaApagada: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoApagado: {
    fontFamily: fonte.medio,
    fontStyle: 'italic',
    fontSize: 14,
    color: c.textoSuave,
  },
  citacao: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  citacaoMinha: {
    borderLeftColor: c.sobreMarca,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  citacaoDele: { borderLeftColor: c.marca, backgroundColor: c.superficieAlta },
  citacaoNome: { fontFamily: fonte.negrito, fontSize: 12 },
  citacaoTexto: { fontFamily: fonte.regular, fontSize: 13, opacity: 0.85 },
  reacoes: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -8,
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: raio.total,
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
  },
  reacoesMinha: { marginLeft: 0, marginRight: 10 },
  reacao: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reacaoConta: { fontFamily: fonte.negrito, fontSize: 11, color: c.textoSuave },
  digitando: { marginBottom: 4 },
  digitandoTexto: {
    fontFamily: fonte.medio,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: c.textoSuave,
  },
  respondendo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: 8,
    backgroundColor: c.superficieAlta,
  },
  respondendoBarra: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: c.marca,
  },
  respondendoNome: { fontFamily: fonte.negrito, fontSize: 12.5, color: c.marca },
  respondendoTexto: { fontFamily: fonte.regular, fontSize: 13.5, color: c.textoSuave },
  microfone: { backgroundColor: c.marcaSuave },
  dele: {
    alignSelf: 'flex-start',
    backgroundColor: c.superficie,
    borderBottomLeftRadius: 4,
  },
  texto: { fontFamily: fonte.regular, fontSize: 15.5, lineHeight: 21, color: c.texto },
  textoMinha: { color: c.sobreMarca },
  hora: {
    fontFamily: fonte.regular,
    fontSize: 11,
    color: c.textoSuave,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  horaMinha: { color: c.sobreMarca, opacity: 0.75 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderColor: c.borda,
  },
  entrada: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: c.superficieAlta,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonte.regular,
    fontSize: 16,
    color: c.texto,
  },
  foto: { width: 220, height: 220, borderRadius: raio.p, marginBottom: 4 },
  anexo: { height: 42, justifyContent: 'center' },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.marca,
  },
}));
