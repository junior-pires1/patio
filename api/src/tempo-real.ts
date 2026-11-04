import type { Server as ServidorHttp } from 'node:http';
import { Server } from 'socket.io';
import { verificarAcesso, type Autenticado } from './seguranca/tokens';
import type { Notificador } from './servicos/notificador';

/**
 * Tempo real com Socket.IO. O aplicativo conecta com o token de acesso
 * (`io(url, { auth: { token } })`) e entra numa sala só dele e na sala da sua
 * faculdade, que vem sempre do token. A API envia os eventos por essas salas;
 * as mensagens em si são gravadas pelas rotas REST.
 */
export function criarTempoReal(
  http: ServidorHttp,
  opcoes: {
    segredoJwt: string;
    origensPermitidas: string[];
    /** Confere no banco se a conta e a faculdade continuam ativas (o token vale 15 min). */
    contaAtiva?: (usuario: Autenticado) => Promise<boolean>;
  },
): Notificador & { fechar: () => Promise<void> } {
  const io = new Server(http, { cors: { origin: opcoes.origensPermitidas } });

  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth.token;
      if (typeof token !== 'string') throw new Error('sem token');
      const usuario = verificarAcesso(token, opcoes.segredoJwt);
      if (opcoes.contaAtiva && !(await opcoes.contaAtiva(usuario)))
        throw new Error('inativa');
      void socket.join([`usuario:${usuario.id}`, `faculdade:${usuario.instituicaoId}`]);
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
    enviarFaculdade(instituicaoId, evento, dados) {
      io.to(`faculdade:${instituicaoId}`).emit(evento, dados);
    },
    desconectar(usuarioIds) {
      if (usuarioIds.length === 0) return;
      io.in(usuarioIds.map((id) => `usuario:${id}`)).disconnectSockets(true);
    },
    desconectarFaculdade(instituicaoId) {
      io.in(`faculdade:${instituicaoId}`).disconnectSockets(true);
    },
    fechar: () => new Promise((ok) => void io.close(() => ok())),
  };
}
