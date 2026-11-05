import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAmpliarFoto } from '@/componentes/FotoAmpliada';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Carta, Curso, Turno } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { useNotificar } from '@/componentes/Notificacoes';
import { useSessao, useUsuario } from '@/sessao';
import { elevacao, espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { OBJETIVOS, RELACOES, resumo, TURNOS } from '@/utils/opcoes';

type Filtro = {
  objetivo?: string;
  ajudaEm?: string;
  cursoId?: string;
  turno?: Turno;
  semestre?: [number, number];
};
const FAIXAS: [number, number, string][] = [
  [1, 2, '1º–2º'],
  [3, 4, '3º–4º'],
  [5, 6, '5º–6º'],
  [7, 12, '7º ou mais'],
];
const LIMITE_GESTO = 110;
const nativo = Platform.OS !== 'web';

/**
 * Descobrir (estilo Tinder): uma carta por vez, da maior para a menor afinidade.
 * Arraste para a direita para curtir e para a esquerda para pular; estrela é
 * super curtida (3 por dia) e a seta desfaz o último pulo.
 */
export default function Descobrir() {
  const estilos = useEstilos();
  const { c, esquema } = useTema();
  const b = useBase();
  const { api } = useSessao();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const { width } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const [ultimaAcao, setUltimaAcao] = useState<'pulo' | 'curtida' | null>(null);
  const [match, setMatch] = useState<{ id: string; apelido: string } | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [posicao] = useState(() => new Animated.ValueXY());
  // Na web, soltar o mouse depois de arrastar também dispara o toque em "Ver perfil".
  // Onde o toque começou: soltar depois de arrastar não abre o perfil.
  const inicioToque = useRef({ x: 0, y: 0 });
  const ampliar = useAmpliarFoto();
  // Quanto a carta está deslocada agora: arrastando, segurar não amplia a foto.
  const deslocamento = useRef(0);
  useEffect(() => {
    const id = posicao.x.addListener(({ value }) => {
      deslocamento.current = value;
    });
    return () => posicao.x.removeListener(id);
  }, [posicao]);

  // RF09: filtros por objetivo, por quem pode ajudar, curso, turno e semestre
  const [filtro, setFiltro] = useState<Filtro>({});
  const precisoDeAjuda = eu.disciplinas.filter((d) => d.relacao === 'PRECISO_AJUDA');
  const cartas = useQuery({
    queryKey: ['descobrir', filtro],
    queryFn: () => {
      const q = new URLSearchParams();
      if (filtro.objetivo) q.set('objetivo', filtro.objetivo);
      if (filtro.ajudaEm) q.set('ajudaEm', filtro.ajudaEm);
      if (filtro.cursoId) q.set('cursoId', filtro.cursoId);
      if (filtro.turno) q.set('turno', filtro.turno);
      if (filtro.semestre) {
        q.set('semestreMin', String(filtro.semestre[0]));
        q.set('semestreMax', String(filtro.semestre[1]));
      }
      return api.get<Carta[]>(`/descobrir?${q.toString()}`);
    },
  });
  const supers = useQuery({
    queryKey: ['super-curtidas'],
    queryFn: () => api.get<{ restantes: number; porDia: number }>('/eu/super-curtidas'),
  });
  const cursos = useQuery({
    queryKey: ['cursos'],
    queryFn: () => api.get<Curso[]>('/cursos'),
    enabled: filtrosAbertos,
  });
  const mudarFiltro = (novo: Filtro) => {
    setIndice(0);
    setUltimaAcao(null);
    setFiltro(novo);
  };
  const filtrosExtras = [filtro.cursoId, filtro.turno, filtro.semestre].filter(
    Boolean,
  ).length;

  const voltarAoCentro = () =>
    Animated.spring(posicao, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      useNativeDriver: nativo,
    }).start();
  const proxima = (acao: 'pulo' | 'curtida') => {
    posicao.setValue({ x: 0, y: 0 });
    setUltimaAcao(acao);
    setIndice((i) => i + 1);
  };
  const aoCurtir = (r: { match: { id: string } | null }, c: Carta) => {
    if (r.match) {
      setMatch({ id: r.match.id, apelido: c.apelido });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
    if (c.curtiuVoce)
      void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
    proxima('curtida');
  };
  const curtir = useMutation({
    mutationFn: (c: Carta) =>
      api.post<{ match: { id: string } | null }>('/curtidas', { paraId: c.id }),
    onSuccess: aoCurtir,
    onError: (e) => {
      voltarAoCentro();
      alerta('Não foi possível curtir', e.message);
    },
  });
  const superCurtir = useMutation({
    mutationFn: (c: Carta) =>
      api.post<{ match: { id: string } | null }>('/curtidas', {
        paraId: c.id,
        super: true,
      }),
    onSuccess: (r, c) => {
      void queryClient.invalidateQueries({ queryKey: ['super-curtidas'] });
      if (!r.match)
        notificar({
          titulo: 'Super curtida enviada!',
          texto: `${c.apelido} vai ser avisado.`,
        });
      aoCurtir(r, c);
    },
    onError: (e) => {
      voltarAoCentro();
      alerta('Super curtida', e.message);
    },
  });
  const pular = useMutation({
    mutationFn: (c: Carta) => api.post('/pulos', { paraId: c.id }),
    onSuccess: (_r, c) => {
      if (c.curtiuVoce)
        void queryClient.invalidateQueries({ queryKey: ['curtidas-recebidas'] });
      proxima('pulo');
    },
    onError: (e) => {
      voltarAoCentro();
      alerta('Não foi possível pular', e.message);
    },
  });
  const desfazer = useMutation({
    mutationFn: () => api.delete('/pulos/ultimo'),
    onSuccess: () => {
      setUltimaAcao(null);
      setIndice((i) => Math.max(0, i - 1));
    },
    onError: (e) => alerta('Não deu para desfazer', e.message),
  });

  function recarregar() {
    setIndice(0);
    setUltimaAcao(null);
    void cartas.refetch();
  }

  const carta = cartas.data?.[indice];
  const ocupado =
    curtir.isPending || pular.isPending || superCurtir.isPending || desfazer.isPending;

  /** Joga a carta para um lado (animação) e depois registra a ação. */
  function lancar(direcao: 'direita' | 'esquerda' | 'cima') {
    if (!carta || ocupado) return;
    const destino =
      direcao === 'cima'
        ? { x: 0, y: -900 }
        : { x: (direcao === 'direita' ? 1 : -1) * (width + 200), y: 40 };
    Animated.timing(posicao, {
      toValue: destino,
      duration: 230,
      useNativeDriver: nativo,
    }).start();
    if (direcao === 'direita') curtir.mutate(carta);
    else if (direcao === 'esquerda') pular.mutate(carta);
    else superCurtir.mutate(carta);
  }

  const gesto = PanResponder.create({
    // Só captura arrasto mais horizontal que vertical: a rolagem da carta continua funcionando.
    onMoveShouldSetPanResponder: (_e, g) =>
      !ocupado && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderMove: (_e, g) => posicao.setValue({ x: g.dx, y: g.dy * 0.25 }),
    onPanResponderRelease: (_e, g) => {
      if (g.dx > LIMITE_GESTO || g.vx > 0.9) lancar('direita');
      else if (g.dx < -LIMITE_GESTO || g.vx < -0.9) lancar('esquerda');
      else voltarAoCentro();
    },
    onPanResponderTerminate: voltarAoCentro,
  });
  const giro = posicao.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-11deg', '0deg', '11deg'],
  });
  const opCurtir = posicao.x.interpolate({
    inputRange: [20, LIMITE_GESTO],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const opPular = posicao.x.interpolate({
    inputRange: [-LIMITE_GESTO, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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

  const perfilIncompleto = eu.disciplinas.length === 0;
  const restantes = supers.data?.restantes ?? 0;
  const algumFiltro = Boolean(filtro.objetivo || filtro.ajudaEm || filtrosExtras);

  return (
    <View style={estilos.fundo}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.barraFiltros}
        contentContainerStyle={estilos.filtros}
      >
        <Pressable
          onPress={() => setFiltrosAbertos(true)}
          style={[estilos.botaoFiltros, filtrosExtras > 0 && estilos.botaoFiltrosAtivo]}
          accessibilityRole="button"
          accessibilityLabel={
            filtrosExtras > 0 ? `Filtros, ${filtrosExtras} ativos` : 'Filtros'
          }
        >
          <Ionicons
            name="options-outline"
            size={17}
            color={filtrosExtras > 0 ? c.fundo : c.texto}
          />
          <Text
            style={[estilos.botaoFiltrosTexto, filtrosExtras > 0 && { color: c.fundo }]}
          >
            Filtros{filtrosExtras > 0 ? ` · ${filtrosExtras}` : ''}
          </Text>
        </Pressable>
        <Chip texto="Todos" ativo={!algumFiltro} aoTocar={() => mudarFiltro({})} />
        {OBJETIVOS.map((o) => (
          <Chip
            key={o.valor}
            texto={o.rotulo}
            ativo={filtro.objetivo === o.valor}
            aoTocar={() =>
              mudarFiltro({
                ...filtro,
                objetivo: filtro.objetivo === o.valor ? undefined : o.valor,
              })
            }
          />
        ))}
        {precisoDeAjuda.map((d) => (
          <Chip
            key={d.disciplina.id}
            texto={`Ajuda em ${d.disciplina.nome}`}
            ativo={filtro.ajudaEm === d.disciplina.id}
            aoTocar={() =>
              mudarFiltro({
                ...filtro,
                ajudaEm: filtro.ajudaEm === d.disciplina.id ? undefined : d.disciplina.id,
              })
            }
          />
        ))}
      </ScrollView>

      {perfilIncompleto ? (
        <Pressable
          style={estilos.dica}
          onPress={() => router.navigate('/perfil/editar')}
          accessibilityRole="button"
        >
          <View style={estilos.dicaIcone}>
            <Ionicons name="school" size={18} color={c.sobreDestaque} />
          </View>
          <View style={estilos.flex}>
            <Text style={estilos.dicaTitulo}>Complete seu perfil</Text>
            <Text style={estilos.dicaTexto}>
              Diga suas disciplinas para acharmos quem pode te ajudar.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textoSuave} />
        </Pressable>
      ) : null}

      {!carta ? (
        <>
          <Aviso
            icone="albums-outline"
            titulo="Por enquanto é só"
            texto={
              algumFiltro
                ? 'Ninguém com esse filtro por enquanto. Tente outro filtro ou "Todos".'
                : 'Você já viu todos os colegas sugeridos. Volte mais tarde: chegam pessoas novas toda semana.'
            }
            acao={{ titulo: 'Procurar de novo', aoTocar: recarregar }}
          />
          {ultimaAcao === 'pulo' ? (
            <View style={estilos.acoes}>
              <BotaoRedondo
                rotulo="Desfazer último pulo"
                icone="arrow-undo"
                tamanho={48}
                aoTocar={() => desfazer.mutate()}
                carregando={desfazer.isPending}
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Animated.View
            {...gesto.panHandlers}
            style={[
              estilos.carta,
              esquema === 'claro' ? elevacao(c, 2) : null,
              {
                transform: [
                  { translateX: posicao.x },
                  { translateY: posicao.y },
                  { rotate: giro },
                ],
              },
            ]}
          >
            <ScrollView contentContainerStyle={estilos.cartaConteudo}>
              <View style={estilos.capa}>
                <View style={estilos.faisca1} />
                <View style={estilos.faisca2} />
                <View style={estilos.faisca3} />
                <View
                  style={estilos.percentual}
                  accessibilityLabel={`${carta.afinidade.percentual}% de afinidade`}
                >
                  <Text style={estilos.percentualValor}>{carta.afinidade.percentual}%</Text>
                  <Text style={estilos.percentualRotulo}>afinidade</Text>
                </View>
                {carta.superCurtiuVoce ? (
                  <View style={estilos.curtiu}>
                    <Ionicons name="star" size={13} color={c.sobreDestaque} />
                    <Text style={estilos.curtiuTexto}>Super curtiu você</Text>
                  </View>
                ) : carta.curtiuVoce ? (
                  <View style={estilos.curtiu}>
                    <Ionicons name="heart" size={13} color={c.sobreDestaque} />
                    <Text style={estilos.curtiuTexto}>Curtiu você</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                style={estilos.identidade}
                {...(() => {
                  const props = ampliar(carta.apelido, carta.fotoUrl);
                  const abrirFoto = props.onLongPress;
                  return abrirFoto
                    ? {
                        ...props,
                        onLongPress: () => {
                          if (Math.abs(deslocamento.current) < 8) abrirFoto();
                        },
                      }
                    : props;
                })()}
                onPressIn={(e) => {
                  inicioToque.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                }}
                onPress={(e) => {
                  const dx = e.nativeEvent.pageX - inicioToque.current.x;
                  const dy = e.nativeEvent.pageY - inicioToque.current.y;
                  if (Math.hypot(dx, dy) < 12)
                    router.push({ pathname: '/usuario/[id]', params: { id: carta.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Ver perfil de ${carta.apelido}`}
              >
                <View style={estilos.anelAvatar}>
                  <Avatar nome={carta.apelido} fotoUrl={carta.fotoUrl} tamanho={96} />
                </View>
                <Text style={estilos.nome}>{carta.apelido}</Text>
                <Text style={estilos.resumo}>{resumo(carta)}</Text>
                <Text style={estilos.verPerfil}>Ver perfil completo</Text>
              </Pressable>

              <View style={estilos.corpo}>
                {carta.frase ? <Text style={estilos.frase}>“{carta.frase}”</Text> : null}

                {carta.afinidade.motivos.length > 0 ? (
                  <View style={estilos.motivos}>
                    <Text style={estilos.motivosTitulo}>Vocês têm em comum</Text>
                    {carta.afinidade.motivos.map((m) => (
                      <Info key={m} icone="sparkles" cor={c.marca} estilo={estilos.motivo}>
                        {m}
                      </Info>
                    ))}
                  </View>
                ) : null}

                {RELACOES.map(({ valor, rotulo }) => {
                  const lista = carta.disciplinas.filter((d) => d.relacao === valor);
                  if (lista.length === 0) return null;
                  return (
                    <View key={valor} style={estilos.grupo}>
                      <Text style={b.rotulo}>{rotulo}</Text>
                      <View style={estilos.chips}>
                        {lista.map((d) => (
                          <Chip
                            key={d.disciplina.id}
                            texto={d.disciplina.nome}
                            tom={valor === 'POSSO_AJUDAR' ? 'marca' : 'neutro'}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
                {carta.interesses.length > 0 ? (
                  <View style={estilos.grupo}>
                    <Text style={b.rotulo}>Interesses</Text>
                    <View style={estilos.chips}>
                      {carta.interesses.map((i) => (
                        <Chip key={i} texto={i} />
                      ))}
                    </View>
                  </View>
                ) : null}
                {carta.sobre ? <Text style={b.subtitulo}>{carta.sobre}</Text> : null}
              </View>
            </ScrollView>
            <Animated.View
              pointerEvents="none"
              style={[estilos.carimbo, estilos.carimboCurtir, { opacity: opCurtir }]}
            >
              <Text style={[estilos.carimboTexto, { color: c.sucesso }]}>CURTIR</Text>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[estilos.carimbo, estilos.carimboPular, { opacity: opPular }]}
            >
              <Text style={[estilos.carimboTexto, { color: c.erro }]}>PULAR</Text>
            </Animated.View>
          </Animated.View>

          <View style={estilos.acoes}>
            <BotaoRedondo
              rotulo="Desfazer último pulo"
              icone="arrow-undo"
              tamanho={46}
              aoTocar={() => desfazer.mutate()}
              carregando={desfazer.isPending}
              desabilitado={ultimaAcao !== 'pulo' || ocupado}
            />
            <BotaoRedondo
              rotulo="Pular"
              icone="close"
              tamanho={62}
              aoTocar={() => lancar('esquerda')}
              carregando={pular.isPending}
              desabilitado={ocupado}
            />
            <BotaoRedondo
              rotulo={`Super curtida, ${restantes} restantes hoje`}
              icone="star"
              tamanho={50}
              contador={restantes}
              aoTocar={() =>
                restantes > 0
                  ? lancar('cima')
                  : alerta(
                      'Acabaram as super curtidas',
                      'Você tem 3 por dia. Amanhã chegam mais.',
                    )
              }
              carregando={superCurtir.isPending}
              desabilitado={ocupado}
            />
            <BotaoRedondo
              rotulo="Curtir"
              icone="heart"
              tamanho={70}
              cheio
              aoTocar={() => lancar('direita')}
              carregando={curtir.isPending}
              desabilitado={ocupado}
            />
          </View>
        </>
      )}

      <Modal
        visible={filtrosAbertos}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltrosAbertos(false)}
      >
        <View style={estilos.folhaFundo}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFiltrosAbertos(false)}
            accessibilityLabel="Fechar filtros"
          />
          <View style={estilos.folha}>
            <Text style={estilos.folhaTitulo}>Filtros</Text>
            <ScrollView contentContainerStyle={estilos.folhaConteudo}>
              <Text style={b.rotulo}>Curso</Text>
              <View style={estilos.chips}>
                <Chip
                  texto="Qualquer curso"
                  ativo={!filtro.cursoId}
                  aoTocar={() => mudarFiltro({ ...filtro, cursoId: undefined })}
                />
                {(cursos.data ?? []).map((cu) => (
                  <Chip
                    key={cu.id}
                    texto={cu.nome}
                    ativo={filtro.cursoId === cu.id}
                    aoTocar={() => mudarFiltro({ ...filtro, cursoId: cu.id })}
                  />
                ))}
              </View>
              <Text style={b.rotulo}>Turno</Text>
              <View style={estilos.chips}>
                <Chip
                  texto="Qualquer turno"
                  ativo={!filtro.turno}
                  aoTocar={() => mudarFiltro({ ...filtro, turno: undefined })}
                />
                {TURNOS.map((t) => (
                  <Chip
                    key={t.valor}
                    texto={t.rotulo}
                    ativo={filtro.turno === t.valor}
                    aoTocar={() => mudarFiltro({ ...filtro, turno: t.valor })}
                  />
                ))}
              </View>
              <Text style={b.rotulo}>Semestre</Text>
              <View style={estilos.chips}>
                <Chip
                  texto="Qualquer semestre"
                  ativo={!filtro.semestre}
                  aoTocar={() => mudarFiltro({ ...filtro, semestre: undefined })}
                />
                {FAIXAS.map(([min, max, rotulo]) => (
                  <Chip
                    key={rotulo}
                    texto={rotulo}
                    ativo={filtro.semestre?.[0] === min}
                    aoTocar={() => mudarFiltro({ ...filtro, semestre: [min, max] })}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={estilos.folhaAcoes}>
              <View style={estilos.flex}>
                <Botao
                  titulo="Limpar"
                  variante="contorno"
                  aoTocar={() =>
                    mudarFiltro({ objetivo: filtro.objetivo, ajudaEm: filtro.ajudaEm })
                  }
                />
              </View>
              <View style={estilos.flex}>
                <Botao
                  titulo={`Ver ${cartas.data.length} ${cartas.data.length === 1 ? 'pessoa' : 'pessoas'}`}
                  aoTocar={() => setFiltrosAbertos(false)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={match !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMatch(null)}
      >
        <View style={estilos.modalFundo}>
          <View style={estilos.modal}>
            <View style={estilos.modalSelo}>
              <Ionicons name="sparkles" size={30} color={c.sobreDestaque} />
            </View>
            <Text style={estilos.modalTitulo}>Conexão feita!</Text>
            <Text style={[b.subtitulo, estilos.centro]}>
              Você e {match?.apelido} se curtiram. Que tal dar um oi?
            </Text>
            <View style={estilos.modalAcoes}>
              <Botao
                titulo="Conversar"
                icone="chatbubble-ellipses"
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
        </View>
      </Modal>
    </View>
  );
}

/** Botões redondos de pular e curtir, no estilo dos apps de cartas. */
function BotaoRedondo({
  rotulo,
  icone,
  tamanho,
  cheio = false,
  contador,
  aoTocar,
  carregando,
  desabilitado,
}: {
  rotulo: string;
  icone: 'close' | 'heart' | 'star' | 'arrow-undo';
  tamanho: number;
  cheio?: boolean;
  contador?: number;
  aoTocar: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
}) {
  const { c, esquema } = useTema();
  const estilos = useEstilos();
  const corIcone = cheio
    ? c.sobreMarca
    : icone === 'close'
      ? c.erro
      : icone === 'star'
        ? c.marca
        : c.textoSuave;
  return (
    <Pressable
      onPress={aoTocar}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desabilitado, busy: carregando }}
      style={({ pressed }) => [
        estilos.redondo,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2 },
        cheio ? { backgroundColor: c.marca, borderColor: c.marca } : null,
        esquema === 'claro' ? elevacao(c, 1) : null,
        pressed && { transform: [{ scale: 0.94 }] },
        desabilitado && !carregando && { opacity: 0.5 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corIcone} />
      ) : (
        <Ionicons name={icone} size={tamanho * 0.42} color={corIcone} />
      )}
      {contador !== undefined ? (
        <View style={estilos.contador}>
          <Text style={estilos.contadorTexto}>{contador}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: {
    flex: 1,
    backgroundColor: c.fundo,
    padding: espaco.g,
    paddingTop: espaco.p,
    gap: espaco.m,
  },
  flex: { flex: 1 },
  centro: { textAlign: 'center' },
  barraFiltros: { flexGrow: 0, flexShrink: 0 },
  filtros: { gap: 8, paddingBottom: 2, alignItems: 'center' },
  dica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    borderRadius: raio.g,
    padding: espaco.m,
    backgroundColor: c.destaqueSuave,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  dicaIcone: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dicaTitulo: { ...tipo.nome, color: c.texto },
  dicaTexto: { ...tipo.apoio, color: c.textoSuave },
  carta: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: c.superficie,
    borderRadius: raio.gg,
    borderWidth: 1,
    borderColor: c.borda,
    overflow: 'hidden',
  },
  cartaConteudo: { paddingBottom: espaco.gg },
  capa: { height: 104, backgroundColor: c.marca, overflow: 'hidden' },
  faisca1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -40,
    top: -70,
    backgroundColor: c.marcaForte,
  },
  faisca2: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 3,
    left: 28,
    top: 26,
    backgroundColor: c.destaque,
    transform: [{ rotate: '-28deg' }],
  },
  faisca3: {
    position: 'absolute',
    width: 12,
    height: 5,
    borderRadius: 3,
    left: 52,
    top: 46,
    backgroundColor: c.destaque,
    transform: [{ rotate: '18deg' }],
  },
  curtiu: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.destaque,
    borderRadius: raio.total,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  curtiuTexto: { color: c.sobreDestaque, fontFamily: fonte.negrito, fontSize: 12.5 },
  percentual: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    alignItems: 'flex-start',
  },
  percentualValor: {
    fontFamily: fonte.extra,
    fontSize: 26,
    lineHeight: 28,
    color: c.sobreMarca,
    letterSpacing: -0.8,
  },
  percentualRotulo: { fontFamily: fonte.semi, fontSize: 12, color: c.sobreMarca },
  verPerfil: { fontFamily: fonte.semi, fontSize: 13, color: c.marca, marginTop: 2 },
  carimbo: {
    position: 'absolute',
    top: 28,
    borderWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: c.superficie,
  },
  carimboCurtir: { left: 22, borderColor: c.sucesso, transform: [{ rotate: '-14deg' }] },
  carimboPular: { right: 22, borderColor: c.erro, transform: [{ rotate: '14deg' }] },
  carimboTexto: { fontFamily: fonte.extra, fontSize: 30, letterSpacing: 1 },
  botaoFiltros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: raio.total,
    borderWidth: 1,
    borderColor: c.borda,
    backgroundColor: c.superficie,
  },
  botaoFiltrosAtivo: { backgroundColor: c.texto, borderColor: c.texto },
  botaoFiltrosTexto: { fontFamily: fonte.semi, fontSize: 13.5, color: c.texto },
  contador: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: c.marca,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.fundo,
  },
  contadorTexto: { fontFamily: fonte.negrito, fontSize: 11, color: c.sobreMarca },
  folhaFundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,8,20,0.5)' },
  folha: {
    backgroundColor: c.superficie,
    borderTopLeftRadius: raio.gg,
    borderTopRightRadius: raio.gg,
    padding: espaco.g,
    paddingBottom: espaco.gg,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: espaco.m,
  },
  folhaTitulo: { ...tipo.secao, color: c.texto },
  folhaConteudo: { gap: 6 },
  folhaAcoes: { flexDirection: 'row', gap: espaco.m },
  identidade: { alignItems: 'center', marginTop: -52, paddingHorizontal: espaco.g, gap: 4 },
  anelAvatar: {
    borderRadius: 60,
    padding: 4,
    backgroundColor: c.superficie,
    marginBottom: 6,
  },
  nome: { ...tipo.titulo, color: c.texto, textAlign: 'center' },
  resumo: { ...tipo.apoio, fontSize: 14, color: c.textoSuave, textAlign: 'center' },
  corpo: { paddingHorizontal: espaco.g + 2, paddingTop: espaco.g, gap: espaco.g },
  frase: {
    fontFamily: fonte.semi,
    fontSize: 17,
    lineHeight: 25,
    color: c.texto,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  motivos: {
    borderRadius: raio.g,
    padding: espaco.m + 2,
    gap: 6,
    backgroundColor: c.marcaSuave,
  },
  motivosTitulo: { ...tipo.sobrescrito, color: c.marca, marginBottom: 2 },
  motivo: { fontSize: 14, color: c.texto, fontFamily: fonte.semi },
  grupo: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  acoes: {
    flexDirection: 'row',
    gap: espaco.g,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  redondo: {
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(6,8,20,0.6)',
    justifyContent: 'center',
    padding: espaco.gg,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: c.superficie,
    borderRadius: raio.gg,
    padding: espaco.gg,
    gap: espaco.m,
  },
  modalSelo: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: c.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitulo: { ...tipo.titulo, color: c.texto, textAlign: 'center' },
  modalAcoes: { alignSelf: 'stretch', gap: espaco.p, marginTop: espaco.p },
}));
