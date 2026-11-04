import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, Text, View } from 'react-native';
import { fonte } from '@/tema';
import { enderecoDaFoto } from '@/utils/endereco';

const tempo = (s: number) => {
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Mensagem de voz: tocar/pausar, barra de progresso e tempo. */
export function PlayerDeAudio({
  url,
  duracaoMs,
  cor,
  corFraca,
}: {
  url: string;
  duracaoMs: number;
  cor: string;
  corFraca: string;
}) {
  const player = useAudioPlayer({ uri: enderecoDaFoto(url) ?? url });
  const status = useAudioPlayerStatus(player);
  const duracao =
    status.duration > 0 && Number.isFinite(status.duration)
      ? status.duration
      : duracaoMs / 1000;
  const progresso = duracao > 0 ? Math.min(1, status.currentTime / duracao) : 0;

  function alternar() {
    if (status.playing) return player.pause();
    if (status.didJustFinish || progresso >= 0.99) void player.seekTo(0);
    player.play();
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 200,
        paddingVertical: 2,
      }}
    >
      <Pressable
        onPress={alternar}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? 'Pausar mensagem de voz' : 'Ouvir mensagem de voz'
        }
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: corFraca,
        }}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={cor} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: corFraca,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: 4, width: `${progresso * 100}%`, backgroundColor: cor }} />
        </View>
        <Text
          style={{ fontFamily: fonte.medio, fontSize: 11.5, color: cor, opacity: 0.85 }}
        >
          {status.playing || status.currentTime > 0
            ? tempo(status.currentTime)
            : tempo(duracao)}
        </Text>
      </View>
      <Ionicons name="mic" size={16} color={cor} style={{ opacity: 0.7 }} />
    </View>
  );
}
