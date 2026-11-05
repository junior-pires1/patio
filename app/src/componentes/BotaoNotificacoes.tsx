import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSessao } from '@/sessao';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';

/** Sininho do cabeçalho com o número de notificações não lidas. */
export function BotaoNotificacoes() {
  const { api } = useSessao();
  const { c, esquema } = useTema();
  const naoLidas = useQuery({
    queryKey: ['notificacoes-nao-lidas'],
    queryFn: () => api.get<{ total: number }>('/notificacoes/nao-lidas'),
  });
  const total = naoLidas.data?.total ?? 0;
  return (
    <Pressable
      onPress={() => router.push('/notificacoes')}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        opacity: pressed ? 0.6 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={total > 0 ? `Notificações, ${total} novas` : 'Notificações'}
    >
      <Ionicons
        name={total > 0 ? 'notifications' : 'notifications-outline'}
        size={23}
        color={c.texto}
      />
      {total > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 3,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: c.erro,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: c.fundo,
          }}
        >
          <Text
            style={{
              color: esquema === 'escuro' ? '#1A0A0A' : '#fff',
              fontFamily: fonte.negrito,
              fontSize: 10,
            }}
          >
            {total > 99 ? '99+' : total}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
