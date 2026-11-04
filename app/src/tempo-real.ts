import { useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ErroApi } from './api/cliente';
import type { Carta, Mensagem, MensagemGrupo, Post } from './api/tipos';
import { useNotificar } from './componentes/Notificacoes';
import { API_URL } from './config';
import { useSessao } from './sessao';

// Listas que mostram dados da faculdade (publicações, avisos, grupos e apelidos).
const LISTAS_DA_FACULDADE = [
  ['feed'],
  ['post'],
  ['comentarios'],
  ['avisos'],
  ['grupos'],
  ['grupo'],
  ['grupo-mensagens'],
  ['matches'],
];
const ESPERA_PARA_RECONECTAR_MS = 3000;

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

    // Reconectou: o que aconteceu durante a queda não vai chegar por evento.
    let jaConectou = false;
    socket.on('connect', () => {
      if (jaConectou) atualizar(...LISTAS_DA_FACULDADE);
      jaConectou = true;
    });

    // Token recusado (venceu durante a queda): o Socket.IO não tenta de novo sozinho.
    // Qualquer chamada à API renova o token; depois disso a conexão pode ser refeita.
    let tentativa: ReturnType<typeof setTimeout> | undefined;
    const tentarReconectar = () => {
      tentativa = setTimeout(() => {
        api
          .get('/eu')
          .then(() => socket.connect())
          .catch((erro: unknown) => {
            // Sem internet: tenta de novo. Sessão perdida ou conta suspensa: desiste.
            if (erro instanceof ErroApi && erro.status === 0) tentarReconectar();
          });
      }, ESPERA_PARA_RECONECTAR_MS);
    };
    socket.on('connect_error', () => {
      if (!socket.active) tentarReconectar();
    });
    // A API derrubou a conexão (conta suspensa, senha trocada pela coordenação):
    // a chamada à API decide se a sessão continua; se não, o app volta ao login.
    socket.on('disconnect', (motivo) => {
      if (motivo === 'io server disconnect') tentarReconectar();
    });

    // Mudanças da faculdade: os eventos só trazem ids; o conteúdo vem da API,
    // que aplica bloqueios e permissões.
    socket.on('post:novo', () => atualizar(['feed']));
    socket.on('post:removido', (evento: { postId: string }) =>
      atualizar(['feed'], ['post', evento.postId], ['comentarios', evento.postId]),
    );
    // Curtidas, comentários e presenças: troca só os números, sem buscar o feed de novo.
    socket.on(
      'post:atualizado',
      (totais: {
        postId: string;
        curtidas: number;
        comentarios: number;
        presencas: number;
      }) => {
        const { postId, ...numeros } = totais;
        queryClient.setQueriesData<{ pages: { posts: Post[] }[] }>(
          { queryKey: ['feed'] },
          (dados) =>
            dados && {
              ...dados,
              pages: dados.pages.map((p) => ({
                ...p,
                posts: p.posts.map((x) => (x.id === postId ? { ...x, ...numeros } : x)),
              })),
            },
        );
        queryClient.setQueryData<Post>(['post', postId], (p) => p && { ...p, ...numeros });
        atualizar(['comentarios', postId]);
      },
    );
    socket.on('aviso:novo', () => atualizar(['avisos']));
    socket.on('aviso:removido', () => atualizar(['avisos']));
    socket.on('grupo:novo', () => atualizar(['grupos']));
    socket.on('grupo:atualizado', (evento: { grupoId: string }) =>
      atualizar(['grupos'], ['grupo', evento.grupoId]),
    );
    socket.on('grupo:removido', (evento: { grupoId: string }) => {
      atualizar(['grupos']);
      queryClient.removeQueries({ queryKey: ['grupo', evento.grupoId] });
    });
    socket.on('perfil:atualizado', (evento: { usuarioId: string }) => {
      atualizar(
        ['feed'],
        ['post'],
        ['comentarios'],
        ['matches'],
        ['grupo'],
        ['grupo-mensagens'],
      );
      // Só troca apelido e foto na carta: buscar as cartas de novo mudaria a carta atual.
      const temCarta = queryClient
        .getQueriesData<Carta[]>({ queryKey: ['descobrir'] })
        .some(([, cartas]) => cartas?.some((c) => c.id === evento.usuarioId));
      if (!temCarta) return;
      api
        .get<{ apelido: string; fotoUrl: string | null }>(`/usuarios/${evento.usuarioId}`)
        .then(({ apelido, fotoUrl }) =>
          queryClient.setQueriesData<Carta[]>({ queryKey: ['descobrir'] }, (cartas) =>
            cartas?.map((c) =>
              c.id === evento.usuarioId ? { ...c, apelido, fotoUrl } : c,
            ),
          ),
        )
        // Conta suspensa ou bloqueada: a carta sai da pilha.
        .catch((erro: unknown) => {
          if (!(erro instanceof ErroApi) || erro.status !== 404) return;
          queryClient.setQueriesData<Carta[]>({ queryKey: ['descobrir'] }, (cartas) =>
            cartas?.filter((c) => c.id !== evento.usuarioId),
          );
        });
    });

    socket.on('curtida:nova', () => {
      atualizar(['curtidas-recebidas'], ['descobrir'], ['atividade']);
      notificar({
        titulo: 'Alguém curtiu você',
        texto: 'A pessoa aparece primeiro nas suas cartas. Toque para ver.',
        aoTocar: () => router.navigate('/'),
      });
    });
    socket.on('match:novo', (evento: { matchId: string }) => {
      atualizar(['matches'], ['curtidas-recebidas']);
      notificar({
        titulo: 'Nova conexão!',
        texto: 'Vocês se curtiram. Toque para conversar.',
        aoTocar: () =>
          router.push({ pathname: '/chat/[id]', params: { id: evento.matchId } }),
      });
    });
    socket.on('match:desfeito', () => atualizar(['matches']));
    socket.on('story:novo', () => atualizar(['stories']));
    socket.on('curtidas:atualizadas', () =>
      atualizar(['curtidas-recebidas'], ['descobrir'], ['atividade'], ['perfil']),
    );
    socket.on('mensagens:lidas', (evento: { matchId: string }) =>
      atualizar(['mensagens', evento.matchId]),
    );
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
    socket.on('grupo:mensagem', (evento: { grupoId: string; mensagem: MensagemGrupo }) => {
      atualizar(['grupo-mensagens', evento.grupoId], ['grupos'], ['grupo', evento.grupoId]);
      const noChat = caminhoAtual.current === `/grupo-chat/${evento.grupoId}`;
      if (evento.mensagem.autor.id !== euId && !noChat) {
        notificar({
          titulo: `${evento.mensagem.autor.apelido} no grupo`,
          texto: evento.mensagem.texto,
          aoTocar: () =>
            router.push({ pathname: '/grupo-chat/[id]', params: { id: evento.grupoId } }),
        });
      }
    });
    return () => {
      clearTimeout(tentativa);
      socket.disconnect();
    };
  }, [logado, euId, api, queryClient, notificar]);
}
