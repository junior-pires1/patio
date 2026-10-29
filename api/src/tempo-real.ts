import type { Server as ServidorHttp } from 'node:http';
import { Server } from 'socket.io';
import { verificarAcesso } from './seguranca/tokens';
import type { Notificador } from './servicos/notificador';

/**
 * Tempo real com Socket.IO. O aplicativo conecta com o token de acesso
 * (`io(url, { auth: { token } })`) e entra numa sala só dele. A API envia os
 * eventos por essa sala; as mensagens em si são gravadas pelas rotas REST.
 */
export function criarTempoReal(
  http: ServidorHttp,
  opcoes: { segredoJwt: string; origensPermitidas: string[] },
): Notificador & { fechar: () => Promise<void> } {
  const io = new Server(http, { cors: { origin: opcoes.origensPermitidas } });

  io.use((socket, next) => {
    try {
      const token: unknown = socket.handshake.auth.token;
      if (typeof token !== 'string') throw new Error('sem token');
      const usuario = verificarAcesso(token, opcoes.segredoJwt);
      void socket.join(`usuario:${usuario.id}`);
      socket.data.usuario = usuario;
      next();
    } catch {
      next(new Error('nao_autenticado'));
    }
  });

  return {
    enviar(usuarioIds, evento, dados) {
      if (usuarioIds.length === 0) return;
      io.to(usuarioIds.map((id) => `usuario:${id}`)).emit(evento, dados);
    },
    fechar: () => new Promise((ok) => void io.close(() => ok())),
  };
}
