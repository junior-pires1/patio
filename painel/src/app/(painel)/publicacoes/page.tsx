'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Botao, Cartao, Estado, Selo, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import { dataHora } from '@/lib/textos';

type Post = {
  id: string;
  categoria: string;
  texto: string;
  eventoInicio: string | null;
  eventoLocal: string | null;
  criadoEm: string;
  autor: { id: string; apelido: string; papel: string };
  curtidas: number;
  comentarios: number;
  presencas: number;
};
type Pagina = { posts: Post[]; temMais: boolean };

const CATEGORIAS: Record<string, string> = {
  GERAL: 'Geral',
  ESTUDOS: 'Estudos',
  EVENTO: 'Evento',
  VAGA: 'Vagas',
  ACHADOS: 'Achados',
};

/** Moderação do feed: a coordenação vê todas as publicações e remove as impróprias. */
export default function PaginaPublicacoes() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState('');

  const feed = useInfiniteQuery({
    queryKey: ['moderacao', categoria],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams();
      if (categoria) q.set('categoria', categoria);
      if (pageParam) q.set('antes', pageParam);
      return api.get<Pagina>(`/feed?${q.toString()}`);
    },
    getNextPageParam: (ultima) =>
      ultima.temMais ? (ultima.posts.at(-1)?.criadoEm ?? null) : null,
  });
  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/posts/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['moderacao'] }),
    onError: (e) => alert(e.message),
  });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <>
      <Titulo descricao="Tudo o que foi publicado no feed da faculdade. Remover fica registrado na auditoria.">
        Publicações
      </Titulo>
      <div className="mb-4 flex flex-wrap gap-2">
        <Botao
          variante={categoria === '' ? 'principal' : 'neutro'}
          onClick={() => setCategoria('')}
        >
          Todas
        </Botao>
        {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
          <Botao
            key={valor}
            variante={categoria === valor ? 'principal' : 'neutro'}
            onClick={() => setCategoria(valor)}
          >
            {rotulo}
          </Botao>
        ))}
      </div>
      <Estado
        carregando={feed.isPending}
        erro={feed.error}
        vazio={posts.length === 0 && !feed.isPending}
        textoVazio="Nenhuma publicação."
      />
      <div className="space-y-3">
        {posts.map((p) => (
          <Cartao key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <strong>{p.autor.apelido}</strong>
                  {p.autor.papel === 'COORDENACAO' ? (
                    <Selo tom="ok">Coordenação</Selo>
                  ) : null}
                  <Selo>{CATEGORIAS[p.categoria] ?? p.categoria}</Selo>
                  <span className="text-xs text-slate-500">{dataHora(p.criadoEm)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line">{p.texto}</p>
                {p.eventoInicio ? (
                  <p className="mt-1 text-sm text-slate-600">
                    📅 {dataHora(p.eventoInicio)}
                    {p.eventoLocal ? ` · ${p.eventoLocal}` : ''} · {p.presencas}{' '}
                    confirmado(s)
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">
                  {p.curtidas} curtida(s) · {p.comentarios} comentário(s)
                </p>
              </div>
              <Botao
                variante="perigo"
                disabled={remover.isPending}
                onClick={() =>
                  confirm('Remover esta publicação do feed?') && remover.mutate(p.id)
                }
              >
                Remover
              </Botao>
            </div>
          </Cartao>
        ))}
      </div>
      {feed.hasNextPage ? (
        <div className="mt-4 text-center">
          <Botao
            variante="neutro"
            carregando={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            Carregar mais
          </Botao>
        </div>
      ) : null}
    </>
  );
}
