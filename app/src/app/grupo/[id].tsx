import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { GrupoDetalhe } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Aviso, Carregando } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, estilosBase, raio, suave } from '@/tema';
import { alerta } from '@/utils/alerta';

/** Detalhe do grupo: informações, membros, entrar/sair e acesso ao chat. */
export default function TelaGrupo() {
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
      if (r.grupoApagado) router.back();
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
        <Text style={estilos.meta}>🗓️ {g.encontro ?? 'Horário a combinar'}</Text>
        <Text style={estilos.meta}>📍 {g.local ?? 'Local a combinar'}</Text>
        <Text style={estilos.meta}>
          👥 {g.membros} de {g.vagas} vagas
        </Text>
      </View>

      {g.souMembro ? (
        <>
          <Botao
            titulo="💬  Abrir chat do grupo"
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

      <Text style={estilosBase.secao}>Membros</Text>
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

const estilos = StyleSheet.create({
  disciplina: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  texto: { fontSize: 16, color: cores.texto, lineHeight: 22 },
  info: {
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    padding: espaco.m,
    gap: 4,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  meta: { fontSize: 15, color: cores.texto },
  membro: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  nome: { fontSize: 15, color: cores.texto, flex: 1 },
  criador: { fontSize: 13, fontWeight: '700' },
});
