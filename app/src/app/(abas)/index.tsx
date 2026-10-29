import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Aviso as AvisoOficial, Carta } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco, estilosBase, raio, suave } from '@/tema';
import { RELACOES, resumo } from '@/utils/opcoes';

/** Descobrir: uma carta por vez, da maior para a menor afinidade. */
export default function Descobrir() {
  const { api } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const [indice, setIndice] = useState(0);
  const [match, setMatch] = useState<{ id: string; apelido: string } | null>(null);

  const cartas = useQuery({
    queryKey: ['descobrir'],
    queryFn: () => api.get<Carta[]>('/descobrir'),
  });
  // RF21: aviso oficial da coordenação fixado no topo
  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<AvisoOficial[]>('/avisos'),
  });
  const aviso = avisos.data?.find((a) => a.fixado);
  const [avisoAberto, setAvisoAberto] = useState(false);

  const proxima = () => setIndice((i) => i + 1);
  const curtir = useMutation({
    mutationFn: (c: Carta) =>
      api.post<{ match: { id: string } | null }>('/curtidas', { paraId: c.id }),
    onSuccess: (r, c) => {
      if (r.match) {
        setMatch({ id: r.match.id, apelido: c.apelido });
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
      if (c.curtiuVoce)
        void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
      proxima();
    },
  });
  const pular = useMutation({
    mutationFn: (c: Carta) => api.post('/pulos', { paraId: c.id }),
    onSuccess: (_r, c) => {
      if (c.curtiuVoce)
        void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
      proxima();
    },
  });

  function recarregar() {
    setIndice(0);
    void cartas.refetch();
  }

  if (cartas.isPending) return <Carregando />;
  if (cartas.isError) {
    return (
      <Aviso
        titulo="Não deu para carregar"
        texto={cartas.error.message}
        acao={{ titulo: 'Tentar de novo', aoTocar: recarregar }}
      />
    );
  }

  const carta = cartas.data[indice];
  const perfilIncompleto = eu.disciplinas.length === 0;

  return (
    <View style={estilos.fundo}>
      {aviso ? (
        <Pressable
          onPress={() => setAvisoAberto((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`Aviso da coordenação: ${aviso.titulo}`}
          style={[estilos.aviso, { borderColor: cor }]}
        >
          <Text style={[estilos.avisoRotulo, { color: cor }]}>📢 Aviso da coordenação</Text>
          <Text style={estilos.avisoTitulo}>{aviso.titulo}</Text>
          {avisoAberto ? <Text style={estilos.avisoTexto}>{aviso.texto}</Text> : null}
        </Pressable>
      ) : null}

      {perfilIncompleto ? (
        <View style={[estilos.dica, { backgroundColor: suave(cor) }]}>
          <Text style={estilos.dicaTexto}>
            Diga suas disciplinas no Perfil para encontrarmos quem pode te ajudar.
          </Text>
          <Botao
            titulo="Completar perfil"
            variante="contorno"
            aoTocar={() => router.navigate('/perfil')}
          />
        </View>
      ) : null}

      {!carta ? (
        <Aviso
          titulo="Por enquanto é só"
          texto="Você já viu todos os colegas sugeridos. Volte mais tarde: chegam pessoas novas toda semana."
          acao={{ titulo: 'Procurar de novo', aoTocar: recarregar }}
        />
      ) : (
        <>
          <ScrollView style={estilos.carta} contentContainerStyle={estilos.cartaConteudo}>
            <View style={estilos.cabecalho}>
              <Avatar nome={carta.apelido} fotoUrl={carta.fotoUrl} tamanho={72} />
              <View style={estilos.flex}>
                <Text style={estilosBase.titulo}>{carta.apelido}</Text>
                <Text style={estilosBase.subtitulo}>{resumo(carta)}</Text>
              </View>
            </View>
            {carta.curtiuVoce ? (
              <View style={[estilos.curtiu, { backgroundColor: cor }]}>
                <Text style={estilos.curtiuTexto}>
                  💙 Curtiu você: curta de volta para conversar
                </Text>
              </View>
            ) : null}
            {carta.frase ? <Text style={estilos.frase}>“{carta.frase}”</Text> : null}

            {carta.afinidade.motivos.length > 0 ? (
              <View style={[estilos.motivos, { backgroundColor: suave(cor) }]}>
                {carta.afinidade.motivos.map((m) => (
                  <Text key={m} style={estilos.motivo}>
                    ✓ {m}
                  </Text>
                ))}
              </View>
            ) : null}

            {RELACOES.map(({ valor, rotulo }) => {
              const lista = carta.disciplinas.filter((d) => d.relacao === valor);
              if (lista.length === 0) return null;
              return (
                <View key={valor} style={estilos.grupo}>
                  <Text style={estilosBase.rotulo}>{rotulo}</Text>
                  <View style={estilos.chips}>
                    {lista.map((d) => (
                      <Chip key={d.disciplina.id} texto={d.disciplina.nome} />
                    ))}
                  </View>
                </View>
              );
            })}
            {carta.interesses.length > 0 ? (
              <View style={estilos.grupo}>
                <Text style={estilosBase.rotulo}>Interesses</Text>
                <View style={estilos.chips}>
                  {carta.interesses.map((i) => (
                    <Chip key={i} texto={i} />
                  ))}
                </View>
              </View>
            ) : null}
            {carta.sobre ? <Text style={estilosBase.subtitulo}>{carta.sobre}</Text> : null}
          </ScrollView>

          <View style={estilos.acoes}>
            <View style={estilos.flex}>
              <Botao
                titulo="Pular"
                variante="contorno"
                aoTocar={() => pular.mutate(carta)}
                carregando={pular.isPending}
                desabilitado={curtir.isPending}
              />
            </View>
            <View style={estilos.flex}>
              <Botao
                titulo="Curtir"
                aoTocar={() => curtir.mutate(carta)}
                carregando={curtir.isPending}
                desabilitado={pular.isPending}
              />
            </View>
          </View>
        </>
      )}

      <Modal
        visible={match !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMatch(null)}
      >
        <View style={estilos.modalFundo}>
          <View style={estilos.modal}>
            <Text style={[estilosBase.titulo, { color: cor }]}>Conexão feita!</Text>
            <Text style={estilosBase.subtitulo}>
              Você e {match?.apelido} se curtiram. Que tal dar um oi?
            </Text>
            <Botao
              titulo="Conversar"
              aoTocar={() => {
                const id = match?.id;
                setMatch(null);
                if (id) router.push({ pathname: '/chat/[id]', params: { id } });
              }}
            />
            <Botao
              titulo="Continuar descobrindo"
              variante="contorno"
              aoTocar={() => setMatch(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo, padding: espaco.g, gap: espaco.m },
  flex: { flex: 1 },
  aviso: {
    backgroundColor: cores.superficie,
    borderWidth: 1.5,
    borderRadius: raio.m,
    padding: espaco.m,
    gap: 2,
  },
  avisoRotulo: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  avisoTitulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  avisoTexto: { fontSize: 14, color: cores.texto, marginTop: 4, lineHeight: 20 },
  dica: { borderRadius: raio.m, padding: espaco.m, gap: espaco.p },
  dicaTexto: { color: cores.texto, fontSize: 14 },
  carta: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaConteudo: { padding: espaco.g, gap: espaco.m },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  curtiu: { borderRadius: raio.m, paddingVertical: 8, paddingHorizontal: 12 },
  curtiuTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  frase: { fontSize: 17, fontStyle: 'italic', color: cores.texto },
  motivos: { borderRadius: raio.m, padding: espaco.m, gap: 4 },
  motivo: { fontSize: 14, color: cores.texto, fontWeight: '500' },
  grupo: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  acoes: { flexDirection: 'row', gap: espaco.m },
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: espaco.gg,
  },
  modal: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    padding: espaco.gg,
    gap: espaco.m,
  },
});
