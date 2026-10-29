import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Mesmo uso do Alert.alert, mas também funciona na versão web do app
 * (no navegador o Alert do React Native não aparece).
 */
export function alerta(titulo: string, texto?: string, botoes?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(titulo, texto, botoes);
    return;
  }
  const mensagem = texto ? `${titulo}\n\n${texto}` : titulo;
  const acoes = (botoes ?? []).filter((b) => b.style !== 'cancel');
  if (acoes.length === 0) {
    window.alert(mensagem);
    return;
  }
  if (acoes.length === 1) {
    if (window.confirm(mensagem)) acoes[0]?.onPress?.();
    return;
  }
  const lista = acoes.map((b, i) => `${i + 1}) ${b.text ?? ''}`).join('\n');
  const escolha = Number(window.prompt(`${mensagem}\n\n${lista}\n\nDigite o número:`));
  acoes[escolha - 1]?.onPress?.();
}
