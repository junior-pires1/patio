import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import type { GrupoDetalhe } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Info } from '@/componentes/Info';
import { Tela } from '@/componentes/Tela';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { espaco, fonte, raio, suave } from '@/tema';
import { criarEstilos, useBase } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { voltar } from '@/utils/navegacao';

/** Detalhe do grupo: informações, membros, entrar/sair e acesso ao chat. */
export default function TelaGrupo() {
  const estilos = useEstilos();
  const b = useBase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const grupo = useQuery({
    queryKey: ['grupo', id],
    queryFn: () => api.get<GrupoDetalhe>(`/grupos/${id}`),
  });
  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: ['grupo', id] });
    void queryClient.invalidateQueries({ queryKey: ['grupos'] });
  };

  const entrar = useMutation({
    mutationFn: () => api.post(`/grupos/${id}/entrar`),
    onSuccess: atualizar,
    onError: (e) => alerta('Não foi possível entrar', e.message),
  });
  const sair = useMutation({
    mutationFn: () => api.post<{ grupoApagado: boolean }>(`/grupos/${id}/sair`),
    onSuccess: (r) => {
      atualizar();
      if (r.grupoApagado) voltar('/grupos');
    },
  });

  if (grupo.isPending) return <Carregando />;
  if (grupo.isError)
    return <Aviso titulo="Grupo indisponível" texto={grupo.error.message} />;
  const g = grupo.data;

  return (
    <Tela rolagem semTopo>
      <Stack.Screen options={{ title: g.nome }} />
      {g.disciplina ? (
        <Text style={[estilos.disciplina, { color: cor, backgroundColor: suave(cor) }]}>
          {g.disciplina.nome}
        </Text>
      ) : null}
      {g.descricao ? <Text style={estilos.texto}>{g.descricao}</Text> : null}
      <View style={estilos.info}>
        <Info icone="time-outline">{g.encontro ?? 'Horário a combinar'}</Info>
        <Info icone="location-outline">{g.local ?? 'Local a combinar'}</Info>
        <Info icone="people-outline">
          {g.membros} de {g.vagas} vagas
        </Info>
      </View>

      {g.souMembro ? (
        <>
          <Botao
            titulo="Abrir chat do grupo"
            aoTocar={() =>
              router.push({
                pathname: '/grupo-chat/[id]',
                params: { id: g.id, nome: g.nome },
              })
            }
          />
          <Botao
            titulo="Sair do grupo"
            variante="contorno"
            carregando={sair.isPending}
            aoTocar={() =>
              alerta(
                'Sair do grupo?',
                g.membros === 1
                  ? 'Você é o último membro: o grupo será apagado.'
                  : undefined,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Sair', style: 'destructive', onPress: () => sair.mutate() },
                ],
              )
            }
          />
        </>
      ) : (
        <Botao
          titulo={g.vagasLivres > 0 ? 'Entrar no grupo' : 'Grupo lotado'}
          aoTocar={() => entrar.mutate()}
          carregando={entrar.isPending}
          desabilitado={g.vagasLivres === 0}
        />
      )}

      <Text style={b.secao}>Membros</Text>
      {g.listaDeMembros.map((m) => (
        <View key={m.usuario.id} style={estilos.membro}>
          <Avatar nome={m.usuario.apelido} fotoUrl={m.usuario.fotoUrl} tamanho={36} />
          <Text style={estilos.nome}>{m.usuario.apelido}</Text>
          {m.papel === 'CRIADOR' ? (
            <Text style={[estilos.criador, { color: cor }]}>criador</Text>
          ) : null}
        </View>
      ))}
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  disciplina: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontFamily: fonte.semi,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  texto: { fontFamily: fonte.regular, fontSize: 16, color: c.texto, lineHeight: 22 },
  info: {
    backgroundColor: c.superficie,
    borderRadius: raio.m,
    padding: espaco.m,
    gap: 4,
    borderWidth: 1,
    borderColor: c.borda,
  },
  meta: { fontFamily: fonte.regular, fontSize: 15, color: c.texto },
  membro: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  nome: { fontFamily: fonte.regular, fontSize: 15, color: c.texto, flex: 1 },
  criador: { fontSize: 13, fontFamily: fonte.negrito },
}));
