import { useQuery } from '@tanstack/react-query';
import { ScrollView, Text, View } from 'react-native';
import type { Termo } from '@/api/tipos';
import { Aviso, Carregando } from '@/componentes/Estados';
import { useSessao } from '@/sessao';
import { espaco, raio, tipo } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

type MeuTermo = {
  atual: Termo;
  aceito: { versao: number; em: string | null } | null;
  pendente: boolean;
};

/** Termo de uso e privacidade da faculdade e quando a pessoa aceitou. */
export default function TelaTermo() {
  const s = useEstilos();
  const { api } = useSessao();
  const termo = useQuery({
    queryKey: ['meu-termo'],
    queryFn: () => api.get<MeuTermo>('/eu/termo'),
  });
  if (termo.isPending) return <Carregando />;
  if (termo.isError)
    return <Aviso titulo="Não deu para carregar" texto={termo.error.message} />;
  const { atual, aceito } = termo.data;
  return (
    <ScrollView style={s.fundo} contentContainerStyle={s.conteudo}>
      <View style={s.resumo}>
        <Text style={s.titulo}>{atual.faculdade.nome}</Text>
        <Text style={s.meta}>
          Versão {atual.versao}
          {atual.publicadoEm
            ? ` · publicada em ${new Date(atual.publicadoEm).toLocaleDateString('pt-BR')}`
            : ''}
        </Text>
        <Text style={s.meta}>
          {aceito
            ? `Você aceitou a versão ${aceito.versao}${
                aceito.em ? ` em ${new Date(aceito.em).toLocaleDateString('pt-BR')}` : ''
              }.`
            : 'Sua conta é anterior ao termo.'}
        </Text>
      </View>
      <Text style={s.corpo} selectable>
        {atual.texto}
      </Text>
    </ScrollView>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  conteudo: {
    padding: espaco.g,
    gap: espaco.m,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  resumo: {
    backgroundColor: c.marcaSuave,
    borderRadius: raio.g,
    padding: espaco.g,
    gap: 2,
  },
  titulo: { ...tipo.nome, color: c.texto },
  meta: { ...tipo.apoio, color: c.textoSuave },
  corpo: { ...tipo.corpo, fontSize: 14, lineHeight: 22, color: c.texto },
}));
