import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';

export const DURACAO_MAXIMA_S = 120;

/**
 * Barra de gravação: começa a gravar ao aparecer; a lixeira cancela e a seta
 * envia. Para sozinha em 2 minutos.
 */
export function GravadorDeVoz({
  aoCancelar,
  aoEnviar,
}: {
  aoCancelar: () => void;
  aoEnviar: (arquivo: { uri: string; duracaoMs: number }) => void;
}) {
  const s = useEstilos();
  const { c } = useTema();
  const gravador = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const estado = useAudioRecorderState(gravador, 200);
  const comecou = useRef(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const permissao = await AudioModule.requestRecordingPermissionsAsync();
      if (!permissao.granted) {
        alerta(
          'Microfone bloqueado',
          'Permita o uso do microfone para gravar mensagens de voz.',
        );
        aoCancelar();
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (cancelado) return;
      await gravador.prepareToRecordAsync();
      gravador.record({ forDuration: DURACAO_MAXIMA_S });
      comecou.current = true;
    })().catch(() => {
      alerta('Não foi possível gravar', 'Confira se o microfone está disponível.');
      aoCancelar();
    });
    return () => {
      cancelado = true;
      if (comecou.current) void gravador.stop().catch(() => undefined);
    };
    // Grava uma vez, ao abrir a barra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function terminar(enviar: boolean) {
    const duracaoMs = estado.durationMillis;
    try {
      await gravador.stop();
    } catch {
      // já parou (limite de tempo)
    }
    comecou.current = false;
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    if (!enviar) return aoCancelar();
    if (!gravador.uri || duracaoMs < 500) {
      alerta('Mensagem muito curta', 'Segure a gravação por pelo menos meio segundo.');
      return aoCancelar();
    }
    aoEnviar({ uri: gravador.uri, duracaoMs });
  }

  const segundos = Math.floor(estado.durationMillis / 1000);
  return (
    <View style={s.barra}>
      <Pressable
        onPress={() => void terminar(false)}
        hitSlop={8}
        style={s.redondo}
        accessibilityRole="button"
        accessibilityLabel="Cancelar gravação"
      >
        <Ionicons name="trash-outline" size={20} color={c.erro} />
      </Pressable>
      <View style={s.meio}>
        <View style={[s.ponto, { opacity: segundos % 2 === 0 ? 1 : 0.35 }]} />
        <Text style={s.tempo}>
          {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}
        </Text>
        <Text style={s.dica} numberOfLines={1}>
          Gravando… (até 2 min)
        </Text>
      </View>
      <Pressable
        onPress={() => void terminar(true)}
        style={s.enviar}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensagem de voz"
      >
        <Ionicons name="arrow-up" size={20} color={c.sobreMarca} />
      </Pressable>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    padding: espaco.p,
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderColor: c.borda,
  },
  redondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.erroSuave,
  },
  meio: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: raio.total,
    backgroundColor: c.superficieAlta,
  },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.erro },
  tempo: { fontFamily: fonte.negrito, fontSize: 15, color: c.texto },
  dica: { flex: 1, fontFamily: fonte.medio, fontSize: 13, color: c.textoSuave },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.marca,
  },
}));
