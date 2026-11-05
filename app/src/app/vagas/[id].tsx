import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { Candidato, StatusCandidatura, Vaga } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Aviso, Carregando, MensagemDeErro } from '@/componentes/Estados';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { Tela } from '@/componentes/Tela';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { quando } from '@/utils/datas';
import { rotuloModalidade, STATUS_CANDIDATURA, tipoVaga } from '@/utils/opcoes';

const ACOES: { status: StatusCandidatura; rotulo: string }[] = [
  { status: 'EM_ANALISE', rotulo: 'Em análise' },
  { status: 'APROVADA', rotulo: 'Aprovar' },
  { status: 'RECUSADA', rotulo: 'Não seguir' },
];

/** Detalhe da vaga: candidatar-se, ou gerenciar candidatos se for quem publicou. */
export default function DetalheVaga() {
  const s = useEstilos();
  const { c } = useTema();
  const b = useBase();
  const { api } = useSessao();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mensagem, setMensagem] = useState('');
  const [escrevendo, setEscrevendo] = useState(false);

  const vaga = useQuery({
    queryKey: ['vaga', id],
    queryFn: () => api.get<Vaga>(`/vagas/${id}`),
  });
  const gerencia = vaga.data?.podeGerenciar === true;
  const candidatos = useQuery({
    queryKey: ['vaga', id, 'candidatos'],
    queryFn: () => api.get<Candidato[]>(`/vagas/${id}/candidatos`),
    enabled: gerencia,
  });
  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: ['vaga', id] });
    void queryClient.invalidateQueries({ queryKey: ['vagas'] });
  };

  const candidatar = useMutation({
    mutationFn: () =>
      api.post(`/vagas/${id}/candidatura`, { mensagem: mensagem.trim() || null }),
    onSuccess: () => {
      setEscrevendo(false);
      setMensagem('');
      atualizar();
    },
  });
  const desistir = useMutation({
    mutationFn: () => api.delete(`/vagas/${id}/candidatura`),
    onSuccess: atualizar,
    onError: (e) => alerta('Não foi possível desistir', e.message),
  });
  const encerrar = useMutation({
    mutationFn: () => api.post(`/vagas/${id}/encerrar`),
    onSuccess: atualizar,
    onError: (e) => alerta('Não foi possível encerrar', e.message),
  });
  const mudarStatus = useMutation({
    mutationFn: (x: { usuarioId: string; status: StatusCandidatura }) =>
      api.put(`/vagas/${id}/candidatos/${x.usuarioId}`, { status: x.status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['vaga', id, 'candidatos'] }),
    onError: (e) => alerta('Não foi possível atualizar', e.message),
  });

  if (vaga.isPending) return <Carregando />;
  if (vaga.isError) {
    return (
      <Aviso
        titulo="Vaga indisponível"
        texto={vaga.error.message}
        icone="briefcase-outline"
      />
    );
  }
  const v = vaga.data;
  const t = tipoVaga(v.tipo);
  const minha = v.minhaCandidatura;
  const souAluno = eu.papel === 'ALUNO';

  return (
    <Tela rolagem semTopo>
      <View style={s.cabecalho}>
        <View style={s.icone}>
          <Ionicons name={t.icone} size={28} color={c.marca} />
        </View>
        <Text style={s.titulo}>{v.titulo}</Text>
        <Text style={s.org}>
          {[v.organizacao, rotuloModalidade(v.modalidade), v.local]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={s.etiquetas}>
          <Text style={s.etiqueta}>{t.rotulo}</Text>
          {v.autor.papel === 'COORDENACAO' ? (
            <Text style={[s.etiqueta, s.oficial]}>Oficial da coordenação</Text>
          ) : null}
          {v.aberta ? (
            <Text style={[s.etiqueta, s.aberta]}>
              {v.prazo
                ? `Aberta até ${v.prazo.slice(8, 10)}/${v.prazo.slice(5, 7)}`
                : 'Aberta'}
            </Text>
          ) : (
            <Text style={[s.etiqueta, s.encerrada]}>Encerrada</Text>
          )}
        </View>
      </View>

      <Pressable
        style={s.autor}
        disabled={v.autor.papel !== 'ALUNO'}
        onPress={() =>
          router.push({ pathname: '/usuario/[id]', params: { id: v.autor.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={`Publicada por ${v.autor.apelido}`}
      >
        <Avatar nome={v.autor.apelido} fotoUrl={v.autor.fotoUrl} tamanho={36} />
        <View style={s.flex}>
          <Text style={s.autorNome}>{v.autor.apelido}</Text>
          <Text style={s.autorMeta}>Publicada {quando(v.criadoEm)}</Text>
        </View>
      </Pressable>

      <View style={b.cartao}>
        <Text style={s.secaoTitulo}>Sobre a vaga</Text>
        <Text style={s.descricao}>{v.descricao}</Text>
        {v.link ? (
          <Pressable
            onPress={() => void Linking.openURL(v.link!)}
            style={s.link}
            accessibilityRole="link"
          >
            <Ionicons name="open-outline" size={16} color={c.marca} />
            <Text style={s.linkTexto}>Mais informações</Text>
          </Pressable>
        ) : null}
      </View>

      {souAluno && !v.minha ? (
        minha ? (
          <View style={[b.cartao, s.status]}>
            <Ionicons
              name={minha.status === 'APROVADA' ? 'checkmark-circle' : 'paper-plane'}
              size={22}
              color={minha.status === 'APROVADA' ? c.sucesso : c.marca}
            />
            <View style={s.flex}>
              <Text style={s.statusTitulo}>
                Candidatura: {STATUS_CANDIDATURA[minha.status]}
              </Text>
              <Text style={s.autorMeta}>Enviada {quando(minha.criadoEm)}</Text>
            </View>
            <Botao
              titulo="Desistir"
              variante="contorno"
              compacto
              carregando={desistir.isPending}
              aoTocar={() =>
                alerta(
                  'Desistir da vaga?',
                  'Quem publicou não verá mais sua candidatura.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Desistir',
                      style: 'destructive',
                      onPress: () => desistir.mutate(),
                    },
                  ],
                )
              }
            />
          </View>
        ) : v.aberta ? (
          escrevendo ? (
            <View style={s.formulario}>
              <Campo
                rotulo="Mensagem para quem publicou (opcional)"
                placeholder="Conte por que você tem interesse e o que já fez."
                multiline
                maxLength={500}
                style={s.multilinha}
                value={mensagem}
                onChangeText={setMensagem}
              />
              <MensagemDeErro texto={candidatar.error?.message} />
              <Botao
                titulo="Enviar candidatura"
                icone="paper-plane"
                carregando={candidatar.isPending}
                aoTocar={() => candidatar.mutate()}
              />
            </View>
          ) : (
            <Botao
              titulo="Quero me candidatar"
              icone="hand-right"
              aoTocar={() => setEscrevendo(true)}
            />
          )
        ) : null
      ) : null}

      {gerencia ? (
        <>
          <Text style={b.secao}>
            Candidatos {candidatos.data ? `(${candidatos.data.length})` : ''}
          </Text>
          {candidatos.isPending ? (
            <Carregando />
          ) : (candidatos.data ?? []).length === 0 ? (
            <Text style={b.subtitulo}>Ninguém se candidatou ainda.</Text>
          ) : (
            candidatos.data!.map((cand) => (
              <View key={cand.usuario.id} style={b.cartao}>
                <LinhaPessoa
                  pessoa={cand.usuario}
                  detalhe={`${STATUS_CANDIDATURA[cand.status]} · ${quando(cand.criadoEm)}`}
                />
                {cand.mensagem ? <Text style={s.descricao}>{cand.mensagem}</Text> : null}
                <View style={s.acoes}>
                  {ACOES.map((a) => (
                    <Pressable
                      key={a.status}
                      onPress={() =>
                        mudarStatus.mutate({ usuarioId: cand.usuario.id, status: a.status })
                      }
                      disabled={mudarStatus.isPending}
                      style={[s.acao, cand.status === a.status && s.acaoAtiva]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cand.status === a.status }}
                    >
                      <Text
                        style={[s.acaoTexto, cand.status === a.status && s.acaoTextoAtivo]}
                      >
                        {a.rotulo}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}
          {v.aberta ? (
            <Botao
              titulo="Encerrar vaga"
              variante="perigo"
              icone="lock-closed"
              carregando={encerrar.isPending}
              aoTocar={() =>
                alerta(
                  'Encerrar a vaga?',
                  'Ela sai da lista e não aceita candidaturas novas.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Encerrar',
                      style: 'destructive',
                      onPress: () => encerrar.mutate(),
                    },
                  ],
                )
              }
            />
          ) : null}
        </>
      ) : null}
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  flex: { flex: 1 },
  cabecalho: { alignItems: 'center', gap: 4, paddingVertical: espaco.p },
  icone: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: c.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  titulo: {
    ...tipo.titulo,
    fontSize: 23,
    lineHeight: 29,
    color: c.texto,
    textAlign: 'center',
  },
  org: { ...tipo.apoio, fontSize: 14, color: c.textoSuave, textAlign: 'center' },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    justifyContent: 'center',
  },
  etiqueta: {
    fontFamily: fonte.semi,
    fontSize: 12,
    color: c.texto,
    backgroundColor: c.superficieAlta,
    borderRadius: raio.total,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  oficial: { backgroundColor: c.marcaSuave, color: c.marca },
  aberta: { backgroundColor: c.sucessoSuave, color: c.sucesso },
  encerrada: { backgroundColor: c.erroSuave, color: c.erro },
  autor: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  autorNome: { ...tipo.nome, color: c.texto },
  autorMeta: { ...tipo.apoio, color: c.textoSuave },
  secaoTitulo: { ...tipo.nome, color: c.texto, marginBottom: 6 },
  descricao: { ...tipo.corpo, color: c.texto },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: espaco.m },
  linkTexto: { fontFamily: fonte.semi, fontSize: 14, color: c.marca },
  status: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  statusTitulo: { ...tipo.nome, color: c.texto },
  formulario: { gap: espaco.m },
  multilinha: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  acoes: { flexDirection: 'row', gap: 6, marginTop: espaco.m, flexWrap: 'wrap' },
  acao: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: raio.total,
    borderWidth: 1,
    borderColor: c.borda,
  },
  acaoAtiva: { backgroundColor: c.texto, borderColor: c.texto },
  acaoTexto: { fontFamily: fonte.semi, fontSize: 13, color: c.texto },
  acaoTextoAtivo: { color: c.fundo },
}));
