import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { Carta } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Chip } from '@/componentes/Chip';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { useSessao, useUsuario } from '@/sessao';
import { elevacao, espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { OBJETIVOS, RELACOES, resumo } from '@/utils/opcoes';

/** Descobrir: uma carta por vez, da maior para a menor afinidade. */
export default function Descobrir() {
  const estilos = useEstilos();
  const { c, esquema } = useTema();
  const b = useBase();
  const { api } = useSessao();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const [indice, setIndice] = useState(0);
  const [match, setMatch] = useState<{ id: string; apelido: string } | null>(null);

  // RF09: filtros por objetivo e por quem pode ajudar numa disciplina em que preciso de ajuda
  const [filtro, setFiltro] = useState<{ objetivo?: string; ajudaEm?: string }>({});
  const precisoDeAjuda = eu.disciplinas.filter((d) => d.relacao === 'PRECISO_AJUDA');
  const cartas = useQuery({
    queryKey: ['descobrir', filtro],
    queryFn: () => {
      const q = new URLSearchParams();
      if (filtro.objetivo) q.set('objetivo', filtro.objetivo);
      if (filtro.ajudaEm) q.set('ajudaEm', filtro.ajudaEm);
      return api.get<Carta[]>(`/descobrir?${q.toString()}`);
    },
  });
  const mudarFiltro = (novo: typeof filtro) => {
    setIndice(0);
    setFiltro(novo);
  };

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
  const ocupado = curtir.isPending || pular.isPending;

  return (
    <View style={estilos.fundo}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.barraFiltros}
        contentContainerStyle={estilos.filtros}
      >
        <Chip
          texto="Todos"
          ativo={!filtro.objetivo && !filtro.ajudaEm}
          aoTocar={() => mudarFiltro({})}
        />
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
        <Aviso
          icone="albums-outline"
          titulo="Por enquanto é só"
          texto={
            filtro.objetivo || filtro.ajudaEm
              ? 'Ninguém com esse filtro por enquanto. Tente outro filtro ou "Todos".'
              : 'Você já viu todos os colegas sugeridos. Volte mais tarde: chegam pessoas novas toda semana.'
          }
          acao={{ titulo: 'Procurar de novo', aoTocar: recarregar }}
        />
      ) : (
        <>
          <View style={[estilos.carta, esquema === 'claro' ? elevacao(c, 2) : null]}>
            <ScrollView contentContainerStyle={estilos.cartaConteudo}>
              <View style={estilos.capa}>
                <View style={estilos.faisca1} />
                <View style={estilos.faisca2} />
                <View style={estilos.faisca3} />
                {carta.curtiuVoce ? (
                  <View style={estilos.curtiu}>
                    <Ionicons name="heart" size={13} color={c.sobreDestaque} />
                    <Text style={estilos.curtiuTexto}>Curtiu você</Text>
                  </View>
                ) : null}
              </View>
              <View style={estilos.identidade}>
                <View style={estilos.anelAvatar}>
                  <Avatar nome={carta.apelido} fotoUrl={carta.fotoUrl} tamanho={96} />
                </View>
                <Text style={estilos.nome}>{carta.apelido}</Text>
                <Text style={estilos.resumo}>{resumo(carta)}</Text>
              </View>

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
          </View>

          <View style={estilos.acoes}>
            <BotaoRedondo
              rotulo="Pular"
              icone="close"
              tamanho={60}
              aoTocar={() => pular.mutate(carta)}
              carregando={pular.isPending}
              desabilitado={ocupado}
            />
            <BotaoRedondo
              rotulo="Ver perfil"
              icone="person-outline"
              tamanho={48}
              aoTocar={() =>
                router.push({ pathname: '/usuario/[id]', params: { id: carta.id } })
              }
            />
            <BotaoRedondo
              rotulo="Curtir"
              icone="heart"
              tamanho={68}
              cheio
              aoTocar={() => curtir.mutate(carta)}
              carregando={curtir.isPending}
              desabilitado={ocupado}
            />
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
  aoTocar,
  carregando,
  desabilitado,
}: {
  rotulo: string;
  icone: 'close' | 'heart' | 'person-outline';
  tamanho: number;
  cheio?: boolean;
  aoTocar: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
}) {
  const { c, esquema } = useTema();
  const estilos = useEstilos();
  const corIcone = cheio ? c.sobreMarca : icone === 'close' ? c.erro : c.textoSuave;
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
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.destaque,
    borderRadius: raio.total,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  curtiuTexto: { color: c.sobreDestaque, fontFamily: fonte.negrito, fontSize: 12.5 },
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
    gap: espaco.gg,
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
