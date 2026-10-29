/** Eventos em tempo real enviados ao aplicativo. */
export type Evento =
  'curtida:nova' | 'match:novo' | 'mensagem:nova' | 'match:desfeito' | 'grupo:mensagem';

/** Envia um evento para os aparelhos conectados de cada usuário. */
export interface Notificador {
  enviar(usuarioIds: string[], evento: Evento, dados: unknown): void;
}

/** Não envia nada (útil em scripts e em testes que não olham o tempo real). */
export const notificadorMudo: Notificador = { enviar() {} };

/** Junta vários notificadores (ex.: tempo real pelo Socket.IO + push da Expo). */
export function combinar(...lista: Notificador[]): Notificador {
  return {
    enviar(usuarioIds, evento, dados) {
      for (const n of lista) n.enviar(usuarioIds, evento, dados);
    },
  };
}
