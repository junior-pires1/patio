import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import Tabs from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { Conexao } from '@/api/tipos';
import { useCorDaFaculdade, useSessao } from '@/sessao';

type NomeIcone = keyof typeof Ionicons.glyphMap;
const icone = (nome: NomeIcone) =>
  function Icone({ color, size }: { color: ColorValue; size: number }) {
    return (
      <Ionicons
        name={nome}
        color={typeof color === 'string' ? color : undefined}
        size={size}
      />
    );
  };

export default function LayoutAbas() {
  const cor = useCorDaFaculdade();
  const { api } = useSessao();
  // Mesma consulta da aba Conexões: o número de não lidas aparece no ícone.
  const conexoes = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get<Conexao[]>('/matches'),
  });
  const naoLidas = conexoes.data?.reduce((soma, c) => soma + c.naoLidas, 0) ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cor,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Descobrir', tabBarIcon: icone('albums-outline') }}
      />
      <Tabs.Screen
        name="conexoes"
        options={{
          title: 'Conexões',
          tabBarIcon: icone('chatbubbles-outline'),
          tabBarBadge: naoLidas > 0 ? naoLidas : undefined,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: icone('person-circle-outline') }}
      />
    </Tabs>
  );
}
