import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { Platform, Text, View, type ColorValue } from 'react-native';
import type { Conexao } from '@/api/tipos';
import { BotaoCabecalho } from '@/componentes/BotaoCabecalho';
import { BotaoNotificacoes } from '@/componentes/BotaoNotificacoes';
import { Marca } from '@/componentes/Marca';
import { useCorDaInstituicao, useSessao, useUsuario } from '@/sessao';
import { fonte, suave } from '@/tema';
import { useTema } from '@/tema-provedor';

type NomeIcone = keyof typeof Ionicons.glyphMap;
/** Ícone vazado quando a aba está fechada e cheio quando está aberta. */
const icone = (nome: NomeIcone, cheio: NomeIcone) =>
  function Icone({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Ionicons
        name={focused ? cheio : nome}
        color={typeof color === 'string' ? color : undefined}
        size={23}
      />
    );
  };

/** Sigla da faculdade no canto do cabeçalho, com a cor dela. */
function SeloFaculdade() {
  const eu = useUsuario();
  const cor = useCorDaInstituicao();
  const { c } = useTema();
  return (
    <View
      style={{
        marginRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: suave(cor, '22'),
      }}
      accessibilityLabel={`Faculdade: ${eu.instituicao.nome}`}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
      <Text style={{ fontFamily: fonte.negrito, fontSize: 12.5, color: c.texto }}>
        {eu.instituicao.sigla}
      </Text>
    </View>
  );
}

export default function LayoutAbas() {
  const { c, esquema } = useTema();
  const { api } = useSessao();
  // Mesma consulta da aba Conexões: o número de não lidas aparece no ícone.
  const conexoes = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.get<Conexao[]>('/matches'),
  });
  const naoLidas = conexoes.data?.reduce((soma, c) => soma + c.naoLidas, 0) ?? 0;
  // Curtidas recebidas que esperam resposta: aparecem no ícone de Descobrir.
  const curtidas = useQuery({
    queryKey: ['curtidas-recebidas'],
    queryFn: () => api.get<{ total: number }>('/curtidas/recebidas'),
  });
  const pendentes = curtidas.data?.total ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.marca,
        tabBarInactiveTintColor: c.textoFraco,
        tabBarStyle: {
          backgroundColor: c.superficie,
          borderTopColor: c.borda,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarItemStyle: { paddingBottom: Platform.OS === 'ios' ? 0 : 6 },
        tabBarLabelStyle: { fontFamily: fonte.semi, fontSize: 11 },
        tabBarBadgeStyle: {
          backgroundColor: c.erro,
          color: esquema === 'escuro' ? '#1A0A0A' : '#fff',
          fontFamily: fonte.negrito,
          fontSize: 11,
        },
        headerStyle: { backgroundColor: c.fundo },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: fonte.extra, fontSize: 24, letterSpacing: -0.6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Descobrir',
          headerTitle: () => <Marca altura={34} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SeloFaculdade />
              <BotaoCabecalho
                icone="heart-circle-outline"
                rotulo="Quem curtiu você"
                contador={pendentes}
                aoTocar={() => router.push('/curtiram')}
              />
              <BotaoNotificacoes />
            </View>
          ),
          tabBarIcon: icone('albums-outline', 'albums'),
          tabBarBadge: pendentes > 0 ? pendentes : undefined,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BotaoCabecalho
                icone="briefcase-outline"
                rotulo="Vagas e oportunidades"
                aoTocar={() => router.push('/vagas')}
              />
              <BotaoNotificacoes />
            </View>
          ),
          tabBarIcon: icone('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{ title: 'Buscar', tabBarIcon: icone('search-outline', 'search') }}
      />
      <Tabs.Screen
        name="grupos"
        options={{ title: 'Grupos', tabBarIcon: icone('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="conexoes"
        options={{
          title: 'Conexões',
          tabBarIcon: icone('chatbubbles-outline', 'chatbubbles'),
          tabBarBadge: naoLidas > 0 ? naoLidas : undefined,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: icone('person-circle-outline', 'person-circle'),
        }}
      />
    </Tabs>
  );
}
