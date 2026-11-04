import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { Conexao } from '@/api/tipos';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { Avatar } from './Avatar';
import { useNotificar } from './Notificacoes';

/** Folha para mandar uma publicação para uma ou mais conexões pelo chat. */
export function Compartilhar({
  postId,
  aberto,
  aoFechar,
}: {
  postId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const s = useEstilos();
  const { c } = useTema();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const [filtro, setFiltro] = useState('');
  const [enviados, setEnviados] = useState<string[]>([]);
  const conexoes = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get<Conexao[]>('/matches'),
    enabled: aberto,
  });
  const enviar = useMutation({
    mutationFn: (conexao: Conexao) =>
      api.post(`/matches/${conexao.id}/mensagens`, { postId }).then(() => conexao),
    onSuccess: (conexao) => {
      setEnviados((e) => [...e, conexao.id]);
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      void queryClient.invalidateQueries({ queryKey: ['mensagens', conexao.id] });
    },
    onError: (e) => notificar({ titulo: 'Não foi possível enviar', texto: e.message }),
  });

  const lista = (conexoes.data ?? []).filter((x) =>
    x.pessoa.apelido.toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  const fechar = () => {
    setFiltro('');
    setEnviados([]);
    aoFechar();
  };

  return (
    <Modal visible={aberto} transparent animationType="slide" onRequestClose={fechar}>
      <View style={s.tela}>
        <Pressable style={s.veu} onPress={fechar} accessibilityLabel="Fechar" />
        <View style={s.folha}>
          <View style={s.alca} />
          <View style={s.topo}>
            <Text style={s.titulo}>Enviar para</Text>
            <Pressable onPress={fechar} hitSlop={10} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={c.texto} />
            </Pressable>
          </View>
          <View style={s.busca}>
            <Ionicons name="search" size={16} color={c.textoSuave} />
            <TextInput
              style={s.entrada}
              placeholder="Procurar conexão"
              placeholderTextColor={c.textoFraco}
              value={filtro}
              onChangeText={setFiltro}
              accessibilityLabel="Procurar conexão"
            />
          </View>
          <FlatList
            data={lista}
            keyExtractor={(x) => x.id}
            style={s.lista}
            ListEmptyComponent={
              <Text style={s.vazio}>
                {conexoes.isPending
                  ? 'Carregando…'
                  : 'Você ainda não tem conexões. Curta colegas em Descobrir.'}
              </Text>
            }
            renderItem={({ item }) => {
              const foi = enviados.includes(item.id);
              return (
                <View style={s.linha}>
                  <Avatar
                    nome={item.pessoa.apelido}
                    fotoUrl={item.pessoa.fotoUrl}
                    tamanho={42}
                  />
                  <Text style={s.nome} numberOfLines={1}>
                    {item.pessoa.apelido}
                  </Text>
                  <Pressable
                    onPress={() => !foi && enviar.mutate(item)}
                    disabled={foi}
                    style={[s.botao, foi && s.botaoFeito]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      foi
                        ? `Enviado para ${item.pessoa.apelido}`
                        : `Enviar para ${item.pessoa.apelido}`
                    }
                  >
                    <Text style={[s.botaoTexto, foi && s.botaoTextoFeito]}>
                      {foi ? 'Enviado' : 'Enviar'}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const useEstilos = criarEstilos((c) => ({
  tela: { flex: 1, justifyContent: 'flex-end' },
  veu: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,8,20,0.5)',
  },
  folha: {
    backgroundColor: c.superficie,
    borderTopLeftRadius: raio.gg,
    borderTopRightRadius: raio.gg,
    paddingHorizontal: espaco.g,
    paddingBottom: espaco.gg,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  alca: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.borda,
    marginTop: 8,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: espaco.m,
  },
  titulo: { fontFamily: fonte.extra, fontSize: 18, color: c.texto },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.superficieAlta,
    borderRadius: raio.m,
    paddingHorizontal: 12,
    marginBottom: espaco.p,
  },
  entrada: { flex: 1, height: 44, fontFamily: fonte.medio, fontSize: 15, color: c.texto },
  lista: { flexGrow: 0 },
  vazio: {
    fontFamily: fonte.medio,
    color: c.textoSuave,
    textAlign: 'center',
    padding: espaco.gg,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingVertical: 8 },
  nome: { flex: 1, fontFamily: fonte.negrito, fontSize: 15, color: c.texto },
  botao: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: raio.total,
    backgroundColor: c.marca,
  },
  botaoFeito: { backgroundColor: c.superficieAlta },
  botaoTexto: { fontFamily: fonte.negrito, fontSize: 13.5, color: c.sobreMarca },
  botaoTextoFeito: { color: c.textoSuave },
}));
