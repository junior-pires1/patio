import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSessao } from './sessao';

let tokenDoAparelho: string | null = null;
/** Token registrado neste aparelho (para remover ao sair da conta). */
export const tokenRegistrado = () => tokenDoAparelho;

// Com o app aberto, os avisos já aparecem no topo da tela (tempo real):
// a notificação do sistema só aparece com o app fechado ou em segundo plano.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Id do projeto na Expo (criado com `npx eas-cli init`). Sem ele não há push. */
function idDoProjeto(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * RF27: pede permissão, registra o aparelho na API e abre a tela certa ao
 * tocar na notificação. Só no celular de verdade (não no navegador nem no
 * simulador) e só se o projeto tiver id da Expo.
 */
export function usePush() {
  const { estado, api } = useSessao();
  const logado = estado.tipo === 'logado';

  useEffect(() => {
    if (!logado || Platform.OS === 'web' || !Device.isDevice) return;
    const projectId = idDoProjeto();
    if (!projectId) {
      console.warn('[push] sem projectId da Expo: rode `npx eas-cli init` na pasta app.');
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted')
          status = (await Notifications.requestPermissionsAsync()).status;
        if (status !== 'granted' || cancelado) return;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await api.put('/eu/push', { token });
        tokenDoAparelho = token;
      } catch (erro) {
        console.warn('[push] não foi possível registrar o aparelho', erro);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [logado, api]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const assinatura = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados = resposta.notification.request.content.data as {
        tipo?: string;
        matchId?: string;
        grupoId?: string;
      };
      if ((dados.tipo === 'mensagem' || dados.tipo === 'match') && dados.matchId) {
        router.push({ pathname: '/chat/[id]', params: { id: dados.matchId } });
      } else if (dados.tipo === 'grupo' && dados.grupoId) {
        router.push({ pathname: '/grupo-chat/[id]', params: { id: dados.grupoId } });
      } else if (dados.tipo === 'curtida') {
        router.navigate('/');
      }
    });
    return () => assinatura.remove();
  }, []);
}
