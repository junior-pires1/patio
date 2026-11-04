import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import { Carregando } from '@/componentes/Estados';
import { ProvedorDeNotificacoes } from '@/componentes/Notificacoes';
import { ProvedorDeSessao, useSessao } from '@/sessao';
import { usePush } from '@/push';
import { fonte } from '@/tema';
import { ProvedorDeTema, useTema } from '@/tema-provedor';
import { useTempoReal } from '@/tempo-real';

export default function Raiz() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } }),
  );
  const [fontesProntas] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorDeTema>
        <ProvedorDeSessao>
          <ProvedorDeNotificacoes>
            <TemaDaNavegacao>
              {fontesProntas ? <Navegacao /> : <Carregando />}
            </TemaDaNavegacao>
          </ProvedorDeNotificacoes>
        </ProvedorDeSessao>
      </ProvedorDeTema>
    </QueryClientProvider>
  );
}

/** Cores e fontes do tema nos cabeçalhos, nas abas e no fundo das telas. */
function TemaDaNavegacao({ children }: { children: ReactNode }) {
  const { esquema, c } = useTema();
  const tema = useMemo<Theme>(() => {
    const base = esquema === 'escuro' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: esquema === 'escuro',
      colors: {
        ...base.colors,
        primary: c.marca,
        background: c.fundo,
        card: c.fundo,
        text: c.texto,
        border: c.borda,
        notification: c.erro,
      },
      // Cada peso é uma família própria; fontWeight fica normal para o navegador não engrossar de novo.
      fonts: {
        regular: { fontFamily: fonte.regular, fontWeight: '400' },
        medium: { fontFamily: fonte.medio, fontWeight: '400' },
        bold: { fontFamily: fonte.negrito, fontWeight: '400' },
        heavy: { fontFamily: fonte.extra, fontWeight: '400' },
      },
    };
  }, [esquema, c]);
  return (
    <ThemeProvider value={tema}>
      <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

/** Telas de quem está logado e de quem não está, protegidas pela sessão. */
function Navegacao() {
  const { estado } = useSessao();
  useTempoReal();
  usePush();
  if (estado.tipo === 'carregando') return <Carregando />;
  const logado = estado.tipo === 'logado';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonte.negrito, fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* Sem sessão, qualquer tela protegida leva ao login (e vice-versa). */}
      <Stack.Protected guard={logado} redirectTo="/entrar">
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Conversa' }} />
        <Stack.Screen
          name="post/[id]"
          options={{ headerShown: true, title: 'Publicação' }}
        />
        <Stack.Screen
          name="publicar"
          options={{ headerShown: true, title: 'Nova publicação', presentation: 'modal' }}
        />
        <Stack.Screen name="grupo/[id]" options={{ headerShown: true, title: 'Grupo' }} />
        <Stack.Screen
          name="grupo-chat/[id]"
          options={{ headerShown: true, title: 'Chat do grupo' }}
        />
        <Stack.Screen
          name="grupos/novo"
          options={{ headerShown: true, title: 'Novo grupo', presentation: 'modal' }}
        />
        <Stack.Screen
          name="usuario/[id]"
          options={{ headerShown: true, title: 'Perfil' }}
        />
        <Stack.Screen
          name="perfil/editar"
          options={{ headerShown: true, title: 'Editar perfil' }}
        />
        <Stack.Screen
          name="perfil/experiencias"
          options={{ headerShown: true, title: 'Experiências' }}
        />
        <Stack.Screen
          name="atividade"
          options={{ headerShown: true, title: 'Atividade' }}
        />
        <Stack.Screen
          name="stories/novo"
          options={{ headerShown: true, title: 'Novo story', presentation: 'modal' }}
        />
        <Stack.Screen name="stories/[autorId]" options={{ animation: 'fade' }} />
        <Stack.Screen name="destaque/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="destaques/novo"
          options={{ headerShown: true, title: 'Novo destaque', presentation: 'modal' }}
        />
        <Stack.Screen
          name="denunciar/[usuarioId]"
          options={{ headerShown: true, title: 'Denunciar', presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!logado} redirectTo="/">
        <Stack.Screen name="(publico)" />
      </Stack.Protected>
    </Stack>
  );
}
