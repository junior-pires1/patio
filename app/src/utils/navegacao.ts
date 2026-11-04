import { router, type Href } from 'expo-router';

/**
 * Volta para a tela anterior. Sem tela anterior (página aberta direto pelo
 * endereço ou recarregada no navegador), vai para `destino`.
 */
export function voltar(destino: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(destino);
}
