import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { MotivoDenuncia } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Chip } from '@/componentes/Chip';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { estilosBase } from '@/tema';
import { MOTIVOS } from '@/utils/opcoes';
import { alerta } from '@/utils/alerta';

/** Denúncia para a coordenação da faculdade, com opção de bloquear junto. */
export default function Denunciar() {
  const { usuarioId, apelido } = useLocalSearchParams<{
    usuarioId: string;
    apelido?: string;
  }>();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [bloquear, setBloquear] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!motivo) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.post('/denuncias', {
        denunciadoId: usuarioId,
        motivo,
        detalhe: detalhe.trim() || undefined,
        bloquear,
      });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      alerta(
        'Denúncia enviada',
        'A coordenação da sua faculdade vai analisar. Obrigado por avisar.',
      );
      if (bloquear) router.dismissTo('/conexoes');
      else router.back();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela rolagem semTopo>
      <Text style={estilosBase.subtitulo}>
        O que aconteceu{apelido ? ` com ${apelido}` : ''}? Só a coordenação vê a denúncia.
      </Text>
      <View style={estilos.chips}>
        {MOTIVOS.map((m) => (
          <Chip
            key={m.valor}
            texto={m.rotulo}
            ativo={motivo === m.valor}
            aoTocar={() => setMotivo(m.valor)}
          />
        ))}
      </View>
      <Campo
        rotulo="Conte mais (opcional)"
        multiline
        maxLength={500}
        style={estilos.multilinha}
        value={detalhe}
        onChangeText={setDetalhe}
      />
      <View style={estilos.linha}>
        <Text style={estilos.textoLinha}>Bloquear também</Text>
        <Switch value={bloquear} onValueChange={setBloquear} />
      </View>
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Enviar denúncia"
        variante="perigo"
        aoTocar={enviar}
        carregando={enviando}
        desabilitado={!motivo}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multilinha: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textoLinha: { fontSize: 16, fontWeight: '500' },
});
