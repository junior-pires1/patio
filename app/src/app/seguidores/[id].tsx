import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList } from 'react-native';
import type { PessoaResumo } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { LinhaPessoa } from '@/componentes/LinhaPessoa';
import { useSessao } from '@/sessao';
import { espaco } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

/** Seguidores ou quem a pessoa segue. */
export default function Seguidores() {
  const s = useEstilos();
  const { api } = useSessao();
  const { id, lado, nome } = useLocalSearchParams<{
    id: string;
    lado: 'seguidores' | 'seguindo';
    nome?: string;
  }>();
  const lista = useQuery({
    queryKey: ['seguidores', id, lado],
    queryFn: () => api.get<PessoaResumo[]>(`/usuarios/${id}/${lado}`),
  });
  const titulo = lado === 'seguindo' ? 'Seguindo' : 'Seguidores';
  return (
    <>
      <Stack.Screen options={{ title: nome ? `${titulo} · ${nome}` : titulo }} />
      {lista.isPending ? (
        <Carregando />
      ) : (
        <FlatList
          style={s.fundo}
          contentContainerStyle={s.conteudo}
          data={lista.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <LinhaPessoa pessoa={item} />}
          ListEmptyComponent={
            <Aviso
              icone="people-outline"
              titulo={
                lado === 'seguindo' ? 'Ainda não segue ninguém' : 'Ainda sem seguidores'
              }
              texto="Seguir é como no LinkedIn: dá para acompanhar as publicações sem precisar de conexão."
            />
          }
        />
      )}
    </>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    paddingHorizontal: espaco.g,
    paddingVertical: espaco.p,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    flexGrow: 1,
  },
}));
