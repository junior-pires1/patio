'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Cartao, Estado, Icone, Titulo, type NomeIcone } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import type { Resumo } from '@/lib/tipos';

function Numero({
  rotulo,
  valor,
  icone,
  destaque,
}: {
  rotulo: string;
  valor: number;
  icone: NomeIcone;
  destaque?: boolean;
}) {
  return (
    <Cartao className="h-full transition hover:-translate-y-0.5">
      <span
        className={`grid size-10 place-items-center rounded-xl ${destaque ? 'bg-erro-suave text-erro' : 'bg-marca-suave text-marca'}`}
      >
        <Icone nome={icone} tamanho={19} />
      </span>
      <p
        className={`mt-4 text-[32px] leading-none font-extrabold tracking-tight ${destaque ? 'text-erro' : ''}`}
      >
        {valor.toLocaleString('pt-BR')}
      </p>
      <p className="mt-1.5 text-sm font-medium text-suave">{rotulo}</p>
    </Cartao>
  );
}

export default function PaginaResumo() {
  const { api } = useSessao();
  const resumo = useQuery({
    queryKey: ['resumo'],
    refetchInterval: 60_000,
    queryFn: () => api.get<Resumo>('/coordenacao/resumo'),
  });

  return (
    <>
      <Titulo descricao="Como está a rede da sua faculdade.">Resumo</Titulo>
      <Estado carregando={resumo.isPending} erro={resumo.error} />
      {resumo.data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Numero
              rotulo="Alunos ativos"
              icone="alunos"
              valor={resumo.data.alunos.ativos}
            />
            <Numero
              rotulo={`Novos (${resumo.data.periodoEmDias} dias)`}
              icone="mais"
              valor={resumo.data.alunos.novosNoPeriodo}
            />
            <Numero
              rotulo="Conexões ativas"
              icone="conta"
              valor={resumo.data.conexoesAtivas}
            />
            <Numero
              rotulo={`Mensagens (${resumo.data.periodoEmDias} dias)`}
              icone="publicacoes"
              valor={resumo.data.mensagensNoPeriodo}
            />
            <Link href="/denuncias" className="block rounded-2xl">
              <Numero
                rotulo="Denúncias abertas"
                icone="denuncia"
                valor={resumo.data.denunciasAbertas}
                destaque={resumo.data.denunciasAbertas > 0}
              />
            </Link>
          </div>

          <Cartao>
            <h2 className="text-lg font-bold">Disciplinas em que os alunos pedem ajuda</h2>
            <p className="mb-4 text-sm text-suave">
              Onde há muita procura e pouca oferta, vale abrir monitoria ou grupo de estudo.
            </p>
            {resumo.data.disciplinasComPedidos.length === 0 ? (
              <p className="text-suave">Nenhum aluno marcou que precisa de ajuda ainda.</p>
            ) : (
              <PedidosDeAjuda itens={resumo.data.disciplinasComPedidos} />
            )}
          </Cartao>
        </div>
      ) : null}
    </>
  );
}

/** Procura x oferta de ajuda por disciplina, em barras lado a lado. */
function PedidosDeAjuda({ itens }: { itens: Resumo['disciplinasComPedidos'] }) {
  const maximo = Math.max(1, ...itens.flatMap((d) => [d.precisamDeAjuda, d.podemAjudar]));
  return (
    <div>
      <div className="mb-4 flex gap-5 text-xs font-semibold text-suave">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-destaque" /> Precisam de ajuda
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-marca" /> Podem ajudar
        </span>
      </div>
      <ul className="space-y-4">
        {itens.map((d) => {
          const falta = d.podemAjudar < d.precisamDeAjuda;
          return (
            <li
              key={d.disciplinaId}
              className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[200px_1fr]"
            >
              <div>
                <p className="font-semibold">{d.nome}</p>
                {falta ? (
                  <p className="text-xs font-semibold text-alerta">Falta quem ajude</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    ['Precisam de ajuda', d.precisamDeAjuda, 'bg-destaque'],
                    ['Podem ajudar', d.podemAjudar, 'bg-marca'],
                  ] as const
                ).map(([rotulo, valor, cor]) => (
                  <div
                    key={rotulo}
                    className="flex items-center gap-3"
                    title={`${rotulo}: ${valor}`}
                  >
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-elevado">
                      <div
                        className={`h-full rounded-full ${cor}`}
                        style={{ width: `${(valor / maximo) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm font-bold tabular-nums">
                      {valor}
                    </span>
                    <span className="sr-only">{rotulo}</span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
