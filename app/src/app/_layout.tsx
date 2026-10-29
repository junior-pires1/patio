import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Carregando } from '@/componentes/Estados';
import { ProvedorDeNotificacoes } from '@/componentes/Notificacoes';
import { ProvedorDeSessao, useSessao } from '@/sessao';
import { useTempoReal } from '@/tempo-real';

export default function Raiz() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorDeSessao>
        <ProvedorDeNotificacoes>
          <StatusBar style="dark" />
          <Navegacao />
        </ProvedorDeNotificacoes>
      </ProvedorDeSessao>
    </QueryClientProvider>
  );
}

/** Telas de quem está logado e de quem não está, protegidas pela sessão. */
function Navegacao() {
  const { estado } = useSessao();
  useTempoReal();
  if (estado.tipo === 'carregando') return <Carregando />;
  const logado = estado.tipo === 'logado';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Sem sessão, qualquer tela protegida leva ao login (e vice-versa). */}
      <Stack.Protected guard={logado} redirectTo="/entrar">
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Conversa' }} />
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
