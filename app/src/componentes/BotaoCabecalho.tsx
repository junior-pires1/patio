import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';

type NomeIcone = keyof typeof Ionicons.glyphMap;

/** Botão redondo de ícone no cabeçalho, com contador opcional. */
export function BotaoCabecalho({
  icone,
  rotulo,
  aoTocar,
  contador = 0,
  cor,
}: {
  icone: NomeIcone;
  rotulo: string;
  aoTocar: () => void;
  contador?: number;
  cor?: string;
}) {
  const { c, esquema } = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={contador > 0 ? `${rotulo}, ${contador}` : rotulo}
    >
      <Ionicons name={icone} size={23} color={cor ?? c.texto} />
      {contador > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: c.erro,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: esquema === 'escuro' ? '#1A0A0A' : '#fff',
              fontFamily: fonte.negrito,
              fontSize: 10.5,
            }}
          >
            {contador > 99 ? '99+' : contador}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
