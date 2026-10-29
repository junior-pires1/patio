/** Eventos em tempo real enviados ao aplicativo. */
export type Evento = 'match:novo' | 'mensagem:nova' | 'match:desfeito';

/** Envia um evento para os aparelhos conectados de cada usuário. */
export interface Notificador {
  enviar(usuarioIds: string[], evento: Evento, dados: unknown): void;
}

/** Não envia nada (útil em scripts e em testes que não olham o tempo real). */
export const notificadorMudo: Notificador = { enviar() {} };
