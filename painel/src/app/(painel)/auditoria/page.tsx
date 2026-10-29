'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Cartao, Estado, Paginacao, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import { ACOES_AUDITORIA, dataHora } from '@/lib/textos';
import type { Pagina, RegistroAuditoria } from '@/lib/tipos';

function detalhe(r: RegistroAuditoria): string {
  const titulo = r.detalhes.titulo;
  if (typeof titulo === 'string') return `“${titulo}”`;
  const motivo = r.detalhes.motivo;
  if (typeof motivo === 'string')
    return `Motivo: ${motivo.toLowerCase().replaceAll('_', ' ')}`;
  return '';
}

export default function PaginaAuditoria() {
  const { api } = useSessao();
  const [pagina, setPagina] = useState(1);
  const registros = useQuery({
    queryKey: ['auditoria', pagina],
    queryFn: () =>
      api.get<Pagina<RegistroAuditoria>>(`/coordenacao/auditoria?pagina=${pagina}`),
  });

  return (
    <>
      <Titulo descricao="Tudo o que a coordenação decidiu, com data e responsável.">
        Auditoria
      </Titulo>
      <Cartao className="overflow-x-auto p-0">
        <Estado
          carregando={registros.isPending}
          erro={registros.error}
          vazio={registros.data?.itens.length === 0}
          textoVazio="Nenhuma ação registrada ainda."
        />
        {registros.data && registros.data.itens.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Quem</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {registros.data.itens.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{dataHora(r.criadoEm)}</td>
                  <td className="px-4 py-3">{r.atorNome ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">
                    {ACOES_AUDITORIA[r.acao] ?? r.acao}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{detalhe(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Cartao>
      {registros.data ? <Paginacao {...registros.data} mudar={setPagina} /> : null}
    </>
  );
}
