import { useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import type { Mensagem } from './api/tipos';
import { useNotificar } from './componentes/Notificacoes';
import { API_URL } from './config';
import { useSessao } from './sessao';

/**
 * Conecta no Socket.IO da API enquanto há alguém logado: atualiza as telas
 * e mostra um aviso quando chega curtida, conexão ou mensagem nova.
 */
export function useTempoReal() {
  const { estado, api } = useSessao();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const logado = estado.tipo === 'logado';
  const euId = estado.tipo === 'logado' ? estado.usuario.id : null;

  // Tela atual, para não avisar de mensagem da conversa que já está aberta.
  const caminho = usePathname();
  const caminhoAtual = useRef(caminho);
  useEffect(() => {
    caminhoAtual.current = caminho;
  }, [caminho]);

  useEffect(() => {
    if (!logado) return;
    const socket = io(API_URL, {
      transports: ['websocket'],
      // Função: a cada reconexão usa o token mais recente.
      auth: (cb) => cb({ token: api.tokenDeAcesso() }),
    });
    const atualizar = (...chaves: string[][]) => {
      for (const queryKey of chaves) void queryClient.invalidateQueries({ queryKey });
    };

    socket.on('curtida:nova', () => {
      atualizar(['curtidas-recebidas'], ['descobrir']);
      notificar({
        titulo: 'Alguém curtiu você 💙',
        texto: 'A pessoa aparece primeiro nas suas cartas. Toque para ver.',
        aoTocar: () => router.navigate('/'),
      });
    });
    socket.on('match:novo', (evento: { matchId: string }) => {
      atualizar(['matches'], ['curtidas-recebidas']);
      notificar({
        titulo: 'Nova conexão! 🎉',
        texto: 'Vocês se curtiram. Toque para conversar.',
        aoTocar: () =>
          router.push({ pathname: '/chat/[id]', params: { id: evento.matchId } }),
      });
    });
    socket.on('match:desfeito', () => atualizar(['matches']));
    socket.on('mensagem:nova', (evento: { matchId: string; mensagem: Mensagem }) => {
      atualizar(['mensagens', evento.matchId], ['matches']);
      const naConversa = caminhoAtual.current === `/chat/${evento.matchId}`;
      if (evento.mensagem.autorId !== euId && !naConversa) {
        notificar({
          titulo: 'Nova mensagem',
          texto: evento.mensagem.texto,
          aoTocar: () =>
            router.push({ pathname: '/chat/[id]', params: { id: evento.matchId } }),
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [logado, euId, api, queryClient, notificar]);
}
