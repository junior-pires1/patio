import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { useSessao } from './sessao';

/**
 * Conecta no Socket.IO da API enquanto há alguém logado e atualiza as telas
 * quando chega match ou mensagem nova.
 */
export function useTempoReal() {
  const { estado, api } = useSessao();
  const queryClient = useQueryClient();
  const logado = estado.tipo === 'logado';

  useEffect(() => {
    if (!logado) return;
    const socket = io(API_URL, {
      transports: ['websocket'],
      // Função: a cada reconexão usa o token mais recente.
      auth: (cb) => cb({ token: api.tokenDeAcesso() }),
    });

    socket.on('match:novo', () => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    });
    socket.on('match:desfeito', () => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    });
    socket.on('mensagem:nova', (evento: { matchId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['mensagens', evento.matchId] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [logado, api, queryClient]);
}
