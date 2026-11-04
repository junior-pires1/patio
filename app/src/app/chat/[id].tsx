import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Conexao, Mensagem } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Imagem } from '@/componentes/Imagem';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco, raio } from '@/tema';
import { quando } from '@/utils/datas';
import { alerta } from '@/utils/alerta';
import { escolherImagem } from '@/utils/foto';
import { voltar } from '@/utils/navegacao';
import { useMensagensAntigas } from '@/utils/mensagensAntigas';

type Pagina = { mensagens: Mensagem[]; temMais: boolean };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');

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
    mutationFn: async ({ t, imagem }: { t: string; imagem?: Blob }) => {
      const enviada = imagem ? await api.enviarImagem(imagem) : null;
      return api.post<Mensagem>(`/matches/${id}/mensagens`, {
        texto: t,
        ...(enviada ? { imagemId: enviada.id } : {}),
      });
    },
    onSuccess: (nova) => {
      setTexto('');
      queryClient.setQueryData<Pagina>(['mensagens', id], (p) =>
        p && !p.mensagens.some((m) => m.id === nova.id)
          ? { ...p, mensagens: [...p.mensagens, nova] }
          : p,
      );
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (e) => alerta('Mensagem não enviada', e.message),
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
            <Ionicons name="ellipsis-vertical" size={22} color={cores.texto} />
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
          data={[...antigas.todas].reverse()}
          onEndReached={() => void antigas.carregar()}
          onEndReachedThreshold={0.3}
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
            return (
              <View
                style={[
                  estilos.balao,
                  minha ? [estilos.minha, { backgroundColor: cor }] : estilos.dele,
                ]}
              >
                {item.imagemUrl ? (
                  <Imagem url={item.imagemUrl} style={estilos.foto} />
                ) : null}
                {item.texto ? (
                  <Text style={[estilos.texto, minha && estilos.textoMinha]}>
                    {item.texto}
                  </Text>
                ) : null}
                <Text style={[estilos.hora, minha && estilos.horaMinha]}>
                  {quando(item.criadoEm)}
                  {minha && item.lidaEm ? ' · lida' : ''}
                </Text>
              </View>
            );
          }}
        />
        <View style={estilos.barra}>
          <Pressable
            onPress={() => void mandarImagem()}
            disabled={enviar.isPending}
            style={estilos.anexo}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Enviar imagem"
          >
            <Ionicons name="image-outline" size={24} color={cores.textoSuave} />
          </Pressable>
          <TextInput
            style={estilos.entrada}
            placeholder="Mensagem"
            placeholderTextColor="#9AA3AE"
            multiline
            maxLength={1000}
            value={texto}
            onChangeText={setTexto}
            accessibilityLabel="Mensagem"
          />
          <Pressable
            onPress={() => texto.trim() && enviar.mutate({ t: texto.trim() })}
            disabled={!texto.trim() || enviar.isPending}
            style={[
              estilos.enviar,
              { backgroundColor: cor, opacity: texto.trim() ? 1 : 0.5 },
            ]}
            accessibilityLabel="Enviar"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  carregando: {
    textAlign: 'center',
    color: cores.textoSuave,
    padding: espaco.p,
  },
  fundo: { flex: 1, backgroundColor: cores.fundo },
  tituloCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tituloTexto: { fontSize: 17, fontWeight: '700', color: cores.texto },
  contatos: {
    textAlign: 'center',
    fontSize: 13,
    color: cores.textoSuave,
    padding: espaco.p,
    backgroundColor: cores.superficie,
  },
  lista: { padding: espaco.m, gap: 6, flexGrow: 1 },
  vazio: {
    textAlign: 'center',
    color: cores.textoSuave,
    marginTop: 24,
    transform: [{ scaleY: -1 }],
  },
  balao: {
    maxWidth: '80%',
    borderRadius: raio.m,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  minha: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  dele: {
    alignSelf: 'flex-start',
    backgroundColor: cores.superficie,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  texto: { fontSize: 16, color: cores.texto },
  textoMinha: { color: '#fff' },
  hora: { fontSize: 11, color: cores.textoSuave, marginTop: 2, alignSelf: 'flex-end' },
  horaMinha: { color: 'rgba(255,255,255,0.8)' },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderColor: cores.borda,
  },
  entrada: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: cores.fundo,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: cores.texto,
  },
  foto: { width: 220, height: 220, borderRadius: raio.p, marginBottom: 4 },
  anexo: { height: 42, justifyContent: 'center' },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
