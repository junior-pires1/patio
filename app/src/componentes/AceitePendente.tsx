import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Termo } from '@/api/tipos';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, raio, tipo } from '@/tema';
import { criarEstilos } from '@/tema-provedor';
import { Botao } from './Botao';
import { Aviso, Carregando, MensagemDeErro } from './Estados';
import { Marca } from './Marca';
import { AceiteDoTermo } from './TermoLgpd';

type MeuTermo = { atual: Termo; pendente: boolean };

/**
 * Tela que aparece no lugar do app para quem ainda não aceitou o termo da
 * faculdade (conta criada pela coordenação). Só libera depois do aceite.
 */
export function AceitePendente() {
  const s = useEstilos();
  const { api, sair, atualizarUsuario } = useSessao();
  const eu = useUsuario();
  const [aceito, setAceito] = useState(false);
  const termo = useQuery({
    queryKey: ['meu-termo'],
    queryFn: () => api.get<MeuTermo>('/eu/termo'),
  });
  const aceitar = useMutation({
    mutationFn: () => api.post('/eu/termo/aceite', { versao: termo.data!.atual.versao }),
    onSuccess: () => atualizarUsuario({ ...eu, termoPendente: false }),
    onError: () => {
      setAceito(false);
      void termo.refetch();
    },
  });

  if (termo.isPending) return <Carregando />;
  if (termo.isError) {
    return (
      <Aviso
        titulo="Não deu para carregar o termo"
        texto={termo.error.message}
        acao={{ titulo: 'Tentar de novo', aoTocar: () => void termo.refetch() }}
      />
    );
  }
  const atual = termo.data.atual;
  return (
    <SafeAreaView style={s.fundo}>
      <View style={s.pagina}>
        <Marca altura={40} />
        <Text style={s.titulo}>Antes de começar</Text>
        <Text style={s.sub}>
          Para usar o Pátio, leia e aceite o termo de uso e privacidade da{' '}
          {atual.faculdade.nome}.
        </Text>
        <View style={s.cartao}>
          <ScrollView contentContainerStyle={s.texto}>
            <Text style={s.corpo} selectable>
              {atual.texto}
            </Text>
          </ScrollView>
        </View>
        <AceiteDoTermo termo={atual} aceito={aceito} aoMudar={setAceito} />
        <MensagemDeErro texto={aceitar.error?.message} />
        <Botao
          titulo="Aceitar e continuar"
          aoTocar={() => aceitar.mutate()}
          carregando={aceitar.isPending}
          desabilitado={!aceito}
        />
        <Botao titulo="Sair da conta" variante="contorno" aoTocar={() => void sair()} />
      </View>
    </SafeAreaView>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.fundo },
  pagina: {
    flex: 1,
    padding: espaco.g,
    gap: espaco.m,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  titulo: { ...tipo.titulo, color: c.texto },
  sub: { ...tipo.corpo, color: c.textoSuave },
  cartao: {
    flex: 1,
    backgroundColor: c.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: c.borda,
    overflow: 'hidden',
  },
  texto: { padding: espaco.g },
  corpo: { ...tipo.corpo, fontSize: 14, lineHeight: 22, color: c.texto },
}));
