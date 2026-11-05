import Ionicons from '@expo/vector-icons/Ionicons';
import { useAmpliarFoto } from '@/componentes/FotoAmpliada';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { CurtidaRecebida } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useNotificar } from '@/componentes/Notificacoes';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { quando } from '@/utils/datas';

/**
 * Quem curtiu você (estilo Tinder): grade com quem curtiu e ainda espera
 * resposta. Super curtidas vêm primeiro, com estrela. Curtir de volta vira conexão.
 */
export default function Curtiram() {
  const s = useEstilos();
  const { c } = useTema();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const { width } = useWindowDimensions();
  const colunas = width > 700 ? 3 : 2;
  const ampliar = useAmpliarFoto();
  const [respondidas, setRespondidas] = useState<Set<string>>(new Set());

  const lista = useQuery({
    queryKey: ['atividade', 'recebidas'],
    queryFn: () => api.get<CurtidaRecebida[]>('/eu/curtidas/recebidas'),
  });
  const responder = useMutation({
    mutationFn: ({ id, curtir }: { id: string; curtir: boolean }) =>
      curtir
        ? api.post<{ match: { id: string } | null }>('/curtidas', { paraId: id })
        : api.post<{ match: null }>('/pulos', { paraId: id }),
    onSuccess: (r, { id }) => {
      setRespondidas((x) => new Set(x).add(id));
      void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
      void queryClient.invalidateQueries({ queryKey: ['descobrir'] });
      if (r.match) {
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
        notificar({ titulo: 'Nova conexão!', texto: 'Agora vocês podem conversar.' });
        const matchId = r.match.id;
        router.push({ pathname: '/chat/[id]', params: { id: matchId } });
      }
    },
    onError: (e) => alerta('Não foi possível responder', e.message),
  });

  if (lista.isPending) return <Carregando />;
  const itens = (lista.data ?? []).filter((x) => !respondidas.has(x.pessoa.id));
  const supers = itens.filter((x) => x.super).length;

  return (
    <FlatList
      key={colunas}
      style={s.fundo}
      contentContainerStyle={s.conteudo}
      data={itens}
      numColumns={colunas}
      columnWrapperStyle={s.linha}
      keyExtractor={(x) => x.pessoa.id}
      ListHeaderComponent={
        itens.length > 0 ? (
          <View style={s.topo}>
            <Text style={s.titulo}>
              {itens.length} {itens.length === 1 ? 'pessoa curtiu' : 'pessoas curtiram'}{' '}
              você
            </Text>
            <Text style={s.sub}>
              {supers > 0
                ? `${supers} com super curtida. Curta de volta para virar conexão.`
                : 'Curta de volta para virar conexão e liberar o chat.'}
            </Text>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <Aviso
          icone="heart-outline"
          titulo="Ninguém esperando resposta"
          texto="Quando alguém curtir você, aparece aqui. Complete o perfil para aparecer mais no Descobrir."
        />
      }
      renderItem={({ item }) => (
        <View style={[s.cartao, item.super && { borderColor: c.destaque, borderWidth: 2 }]}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/usuario/[id]', params: { id: item.pessoa.id } })
            }
            {...ampliar(item.pessoa.apelido, item.pessoa.fotoUrl)}
            style={s.capa}
            accessibilityRole="button"
            accessibilityLabel={`Perfil de ${item.pessoa.apelido}`}
          >
            <Avatar nome={item.pessoa.apelido} fotoUrl={item.pessoa.fotoUrl} tamanho={84} />
            {item.super ? (
              <View style={s.selo}>
                <Ionicons name="star" size={12} color={c.sobreDestaque} />
                <Text style={s.seloTexto}>Super</Text>
              </View>
            ) : null}
          </Pressable>
          <Text style={s.nome} numberOfLines={1}>
            {item.pessoa.apelido}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {[item.pessoa.curso?.nome, quando(item.curtidoEm)].filter(Boolean).join(' · ')}
          </Text>
          <View style={s.acoes}>
            <Pressable
              onPress={() => responder.mutate({ id: item.pessoa.id, curtir: false })}
              disabled={responder.isPending}
              style={[s.botao, s.pular]}
              accessibilityRole="button"
              accessibilityLabel={`Pular ${item.pessoa.apelido}`}
            >
              <Ionicons name="close" size={20} color={c.erro} />
            </Pressable>
            <Pressable
              onPress={() => responder.mutate({ id: item.pessoa.id, curtir: true })}
              disabled={responder.isPending}
              style={[s.botao, s.curtir]}
              accessibilityRole="button"
              accessibilityLabel={`Curtir ${item.pessoa.apelido} de volta`}
            >
              <Ionicons name="heart" size={20} color={c.sobreMarca} />
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    padding: espaco.g,
    gap: espaco.m,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexGrow: 1,
  },
  topo: { gap: 2, marginBottom: espaco.p },
  titulo: { ...tipo.secao, color: c.texto },
  sub: { ...tipo.apoio, color: c.textoSuave },
  linha: { gap: espaco.m },
  cartao: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.m,
    paddingTop: espaco.g,
    gap: 2,
  },
  capa: { alignItems: 'center', marginBottom: 6 },
  selo: {
    position: 'absolute',
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.destaque,
    borderRadius: raio.total,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seloTexto: { fontFamily: fonte.negrito, fontSize: 11, color: c.sobreDestaque },
  nome: { ...tipo.nome, color: c.texto, marginTop: 6 },
  meta: { ...tipo.apoio, fontSize: 12, color: c.textoSuave },
  acoes: { flexDirection: 'row', gap: espaco.m, marginTop: espaco.p },
  botao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pular: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.superficie },
  curtir: { backgroundColor: c.marca },
}));
