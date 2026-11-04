'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NovoAluno } from '@/componentes/NovoAluno';
import { Botao, Cartao, Estado, Paginacao, Selo, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';
import { dataHora } from '@/lib/textos';
import type { Aluno, Pagina } from '@/lib/tipos';

export default function PaginaAlunos() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'' | 'ATIVA' | 'SUSPENSA'>('');
  const [pagina, setPagina] = useState(1);

  const parametros = new URLSearchParams({ pagina: String(pagina) });
  if (busca) parametros.set('busca', busca);
  if (status) parametros.set('status', status);

  const lista = useQuery({
    queryKey: ['alunos', busca, status, pagina],
    queryFn: () => api.get<Pagina<Aluno>>(`/coordenacao/alunos?${parametros.toString()}`),
  });

  const mudar = useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: 'suspender' | 'reativar' }) =>
      api.post(`/coordenacao/alunos/${id}/${acao}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alunos'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo'] });
    },
    onError: (e) => alert(e.message),
  });

  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string } | null>(null);
  const novaSenha = useMutation({
    mutationFn: (id: string) =>
      api.post<{ email: string; senhaProvisoria: string }>(
        `/coordenacao/alunos/${id}/senha`,
      ),
    onSuccess: (r) => setSenhaNova({ email: r.email, senha: r.senhaProvisoria }),
    onError: (e) => alert(e.message),
  });

  return (
    <>
      <Titulo descricao="Cadastre, busque, suspenda ou reative contas de alunos.">
        Alunos
      </Titulo>
      <NovoAluno />
      {senhaNova ? (
        <p
          role="status"
          className="mb-4 max-w-2xl rounded-lg bg-sucesso-suave p-3 text-sm text-sucesso"
        >
          Nova senha provisória de <strong>{senhaNova.email}</strong>:{' '}
          <code className="rounded bg-superficie px-1 font-mono text-base">
            {senhaNova.senha}
          </code>
          . As sessões abertas dele foram encerradas.{' '}
          <button className="underline" onClick={() => setSenhaNova(null)}>
            Ok
          </button>
        </p>
      ) : null}
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setBusca(texto.trim());
          setPagina(1);
        }}
      >
        <input
          aria-label="Buscar por nome, apelido ou e-mail"
          placeholder="Nome, apelido ou e-mail"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="campo w-auto min-w-60 flex-1"
        />
        <select
          aria-label="Situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPagina(1);
          }}
          className="campo w-auto"
        >
          <option value="">Todas as situações</option>
          <option value="ATIVA">Ativas</option>
          <option value="SUSPENSA">Suspensas</option>
        </select>
        <Botao type="submit">Buscar</Botao>
      </form>

      <Cartao className="overflow-x-auto p-0">
        <Estado
          carregando={lista.isPending}
          erro={lista.error}
          vazio={lista.data?.itens.length === 0}
          textoVazio="Nenhum aluno encontrado."
        />
        {lista.data && lista.data.itens.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borda bg-elevado/60 text-xs tracking-wide text-suave uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Aluno</th>
                <th className="px-4 py-3 font-semibold">Curso</th>
                <th className="px-4 py-3 font-semibold">Desde</th>
                <th className="px-4 py-3 font-semibold">Ocorrências</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.data.itens.map((a) => (
                <tr key={a.id} className="border-b border-borda last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-marca-suave text-sm font-extrabold text-marca">
                        {a.nome.trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{a.nome}</p>
                        <p className="text-xs text-suave">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.curso
                      ? `${a.curso.nome}${a.semestre ? ` · ${a.semestre}º` : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-suave">
                    {dataHora(a.criadoEm).slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        a.totalDeDenuncias > 0 ? 'font-bold text-erro' : 'text-suave'
                      }
                      title="Denúncias recebidas"
                    >
                      {a.totalDeDenuncias} den.
                    </span>
                    <span className="mx-1.5 text-fraco">·</span>
                    <span
                      className={
                        a.advertencias > 0 ? 'font-bold text-alerta' : 'text-suave'
                      }
                      title="Advertências"
                    >
                      {a.advertencias} adv.
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'ATIVA' ? (
                      <Selo tom="ok">Ativa</Selo>
                    ) : (
                      <Selo tom="perigo">Suspensa</Selo>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Botao
                        variante="neutro"
                        className="whitespace-nowrap"
                        disabled={novaSenha.isPending}
                        onClick={() =>
                          confirm(
                            `Gerar uma nova senha provisória para ${a.nome}? A senha atual deixa de valer.`,
                          ) && novaSenha.mutate(a.id)
                        }
                      >
                        Nova senha
                      </Botao>
                      {a.status === 'ATIVA' ? (
                        <Botao
                          variante="perigo"
                          disabled={mudar.isPending}
                          onClick={() =>
                            confirm(`Suspender a conta de ${a.nome}?`) &&
                            mudar.mutate({ id: a.id, acao: 'suspender' })
                          }
                        >
                          Suspender
                        </Botao>
                      ) : (
                        <Botao
                          variante="contorno"
                          disabled={mudar.isPending}
                          onClick={() => mudar.mutate({ id: a.id, acao: 'reativar' })}
                        >
                          Reativar
                        </Botao>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Cartao>
      {lista.data ? <Paginacao {...lista.data} mudar={setPagina} /> : null}
    </>
  );
}
