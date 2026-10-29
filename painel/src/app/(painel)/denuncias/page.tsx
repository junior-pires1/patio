'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Botao, Cartao, Estado, Paginacao, Selo, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import { ACOES, MOTIVOS, dataHora } from '@/lib/textos';
import type { Acao, Denuncia, Pagina } from '@/lib/tipos';

const CONFIRMACOES: Record<Acao, string> = {
  ARQUIVADA: 'Arquivar esta denúncia sem punição?',
  ADVERTENCIA: 'Registrar uma advertência para o aluno denunciado?',
  SUSPENSAO: 'Suspender a conta do aluno denunciado? Ele perde o acesso na hora.',
};

export default function PaginaDenuncias() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'ABERTA' | 'RESOLVIDA'>('ABERTA');
  const [pagina, setPagina] = useState(1);

  const lista = useQuery({
    queryKey: ['denuncias', status, pagina],
    queryFn: () =>
      api.get<Pagina<Denuncia>>(`/coordenacao/denuncias?status=${status}&pagina=${pagina}`),
  });

  const decidir = useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: Acao }) =>
      api.post(`/coordenacao/denuncias/${id}/decisao`, { acao }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['denuncias'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo'] });
    },
    onError: (e) => alert(e.message),
  });

  const escolher = (id: string, acao: Acao) => {
    if (confirm(CONFIRMACOES[acao])) decidir.mutate({ id, acao });
  };

  return (
    <>
      <Titulo descricao="Analise e decida. Toda decisão fica registrada na auditoria.">
        Denúncias
      </Titulo>
      <div className="mb-4 flex gap-2" role="tablist">
        {(['ABERTA', 'RESOLVIDA'] as const).map((s) => (
          <Botao
            key={s}
            role="tab"
            aria-selected={status === s}
            variante={status === s ? 'principal' : 'neutro'}
            onClick={() => {
              setStatus(s);
              setPagina(1);
            }}
          >
            {s === 'ABERTA' ? 'Abertas' : 'Resolvidas'}
          </Botao>
        ))}
      </div>

      <Estado
        carregando={lista.isPending}
        erro={lista.error}
        vazio={lista.data?.itens.length === 0}
        textoVazio={
          status === 'ABERTA'
            ? 'Nenhuma denúncia aberta. 🎉'
            : 'Nenhuma denúncia resolvida ainda.'
        }
      />
      <div className="space-y-4">
        {lista.data?.itens.map((d) => (
          <Cartao key={d.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Selo tom="perigo">{MOTIVOS[d.motivo] ?? d.motivo}</Selo>
                  {d.acao ? (
                    <Selo tom={d.acao === 'ARQUIVADA' ? 'neutro' : 'alerta'}>
                      {ACOES[d.acao]}
                    </Selo>
                  ) : null}
                  <span className="text-xs text-slate-500">{dataHora(d.criadoEm)}</span>
                </div>
                <p className="mt-3 text-sm">
                  <span className="text-slate-500">Denunciado: </span>
                  <strong>{d.denunciado.nome}</strong> ({d.denunciado.apelido}) ·{' '}
                  {d.denunciado.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {d.denunciado.totalDeDenuncias} denúncia(s) recebida(s) ·{' '}
                  {d.denunciado.advertencias} advertência(s)
                  {d.denunciado.status === 'SUSPENSA' ? ' · conta suspensa' : ''}
                </p>
                <p className="mt-2 text-sm">
                  <span className="text-slate-500">Denunciante: </span>
                  {d.denunciante.nome} · {d.denunciante.email}
                </p>
                {d.detalhe ? (
                  <blockquote className="mt-3 border-l-4 border-slate-200 pl-3 text-sm text-slate-700">
                    {d.detalhe}
                  </blockquote>
                ) : null}
                {d.resolvidaEm ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Decidida em {dataHora(d.resolvidaEm)}
                    {d.resolvidaPor ? ` por ${d.resolvidaPor.nome}` : ''}
                  </p>
                ) : null}
              </div>
              {d.status === 'ABERTA' ? (
                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="neutro"
                    onClick={() => escolher(d.id, 'ARQUIVADA')}
                    disabled={decidir.isPending}
                  >
                    Arquivar
                  </Botao>
                  <Botao
                    variante="contorno"
                    onClick={() => escolher(d.id, 'ADVERTENCIA')}
                    disabled={decidir.isPending}
                  >
                    Advertir
                  </Botao>
                  <Botao
                    variante="perigo"
                    onClick={() => escolher(d.id, 'SUSPENSAO')}
                    disabled={decidir.isPending}
                  >
                    Suspender
                  </Botao>
                </div>
              ) : null}
            </div>
          </Cartao>
        ))}
      </div>
      {lista.data ? <Paginacao {...lista.data} mudar={setPagina} /> : null}
    </>
  );
}
