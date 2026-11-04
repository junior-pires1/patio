/** Eventos em tempo real enviados ao aplicativo. */
export type Evento =
  | 'curtida:nova'
  | 'curtidas:atualizadas'
  | 'story:novo'
  | 'match:novo'
  | 'mensagem:nova'
  | 'mensagens:lidas'
  | 'match:desfeito'
  | 'grupo:mensagem';

/**
 * Mudanças que interessam a toda a faculdade. Levam só identificadores: o
 * aplicativo busca o conteúdo pela API, que aplica bloqueios e permissões.
 */
export type EventoFaculdade =
  | 'post:novo'
  | 'post:removido'
  | 'post:atualizado'
  | 'perfil:atualizado'
  | 'aviso:novo'
  | 'aviso:removido'
  | 'grupo:novo'
  | 'grupo:atualizado'
  | 'grupo:removido';

/** Envia eventos para os aparelhos conectados. */
export interface Notificador {
  /** Para os aparelhos de cada usuário da lista. */
  enviar(usuarioIds: string[], evento: Evento, dados: unknown): void;
  /** Para os aparelhos de todos os usuários conectados da faculdade. */
  enviarFaculdade(instituicaoId: string, evento: EventoFaculdade, dados: unknown): void;
  /** Derruba as conexões em tempo real (conta suspensa, senha trocada pela coordenação). */
  desconectar(usuarioIds: string[]): void;
  /** Derruba as conexões de toda a faculdade (faculdade desativada). */
  desconectarFaculdade(instituicaoId: string): void;
}

/** Não envia nada (útil em scripts e em testes que não olham o tempo real). */
export const notificadorMudo: Notificador = {
  enviar() {},
  enviarFaculdade() {},
  desconectar() {},
  desconectarFaculdade() {},
};

/** Junta vários notificadores (ex.: tempo real pelo Socket.IO + push da Expo). */
export function combinar(...lista: Notificador[]): Notificador {
  return {
    enviar(usuarioIds, evento, dados) {
      for (const n of lista) n.enviar(usuarioIds, evento, dados);
    },
    enviarFaculdade(instituicaoId, evento, dados) {
      for (const n of lista) n.enviarFaculdade(instituicaoId, evento, dados);
    },
    desconectar(usuarioIds) {
      for (const n of lista) n.desconectar(usuarioIds);
    },
    desconectarFaculdade(instituicaoId) {
      for (const n of lista) n.desconectarFaculdade(instituicaoId);
    },
  };
}
