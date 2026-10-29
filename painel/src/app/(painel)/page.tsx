'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Cartao, Estado, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import type { Resumo } from '@/lib/tipos';

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <Cartao>
      <p className="text-sm text-slate-600">{rotulo}</p>
      <p className={`mt-1 text-3xl font-bold ${destaque ? 'text-red-600' : ''}`}>{valor}</p>
    </Cartao>
  );
}

export default function PaginaResumo() {
  const { api } = useSessao();
  const resumo = useQuery({
    queryKey: ['resumo'],
    queryFn: () => api.get<Resumo>('/coordenacao/resumo'),
  });

  return (
    <>
      <Titulo descricao="Como está a rede da sua faculdade.">Resumo</Titulo>
      <Estado carregando={resumo.isPending} erro={resumo.error} />
      {resumo.data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Numero rotulo="Alunos ativos" valor={resumo.data.alunos.ativos} />
            <Numero
              rotulo={`Novos (${resumo.data.periodoEmDias} dias)`}
              valor={resumo.data.alunos.novosNoPeriodo}
            />
            <Numero rotulo="Conexões ativas" valor={resumo.data.conexoesAtivas} />
            <Numero
              rotulo={`Mensagens (${resumo.data.periodoEmDias} dias)`}
              valor={resumo.data.mensagensNoPeriodo}
            />
            <Link href="/denuncias" className="block">
              <Numero
                rotulo="Denúncias abertas"
                valor={resumo.data.denunciasAbertas}
                destaque={resumo.data.denunciasAbertas > 0}
              />
            </Link>
          </div>

          <Cartao>
            <h2 className="text-lg font-semibold">
              Disciplinas em que os alunos pedem ajuda
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Onde há muita procura e pouca oferta, vale abrir monitoria ou grupo de estudo.
            </p>
            {resumo.data.disciplinasComPedidos.length === 0 ? (
              <p className="text-slate-500">
                Nenhum aluno marcou que precisa de ajuda ainda.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Disciplina</th>
                    <th className="py-2 font-medium">Precisam de ajuda</th>
                    <th className="py-2 font-medium">Podem ajudar</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.data.disciplinasComPedidos.map((d) => (
                    <tr
                      key={d.disciplinaId}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 font-medium">{d.nome}</td>
                      <td className="py-2">{d.precisamDeAjuda}</td>
                      <td
                        className={`py-2 ${d.podemAjudar < d.precisamDeAjuda ? 'font-semibold text-amber-700' : ''}`}
                      >
                        {d.podemAjudar}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>
      ) : null}
    </>
  );
}
