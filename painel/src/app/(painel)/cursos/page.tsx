'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Botao, Cartao, Estado, Titulo } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';

type Curso = { id: string; nome: string };
type Disciplina = { id: string; nome: string; cursoId: string | null };

const campo =
  'rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)]';

/** Cursos e disciplinas da faculdade: aparecem no cadastro, no perfil e nos filtros. */
export default function PaginaCursos() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [nomeCurso, setNomeCurso] = useState('');
  const [nomeDisciplina, setNomeDisciplina] = useState('');
  const [cursoDaDisciplina, setCursoDaDisciplina] = useState('');
  const [erro, setErro] = useState('');

  const cursos = useQuery({
    queryKey: ['cursos'],
    queryFn: () => api.get<Curso[]>('/cursos'),
  });
  const disciplinas = useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => api.get<Disciplina[]>('/disciplinas'),
  });

  const atualizar = () => {
    setErro('');
    void queryClient.invalidateQueries({ queryKey: ['cursos'] });
    void queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
  };
  const mostrarErro = (e: Error) => setErro(e.message);

  const criarCurso = useMutation({
    mutationFn: (nome: string) => api.post('/coordenacao/cursos', { nome }),
    onSuccess: () => {
      setNomeCurso('');
      atualizar();
    },
    onError: mostrarErro,
  });
  const criarDisciplina = useMutation({
    mutationFn: (dados: { nome: string; cursoId: string | null }) =>
      api.post('/coordenacao/disciplinas', dados),
    onSuccess: () => {
      setNomeDisciplina('');
      atualizar();
    },
    onError: mostrarErro,
  });
  const remover = useMutation({
    mutationFn: ({ tipo, id }: { tipo: 'cursos' | 'disciplinas'; id: string }) =>
      api.delete(`/coordenacao/${tipo}/${id}`),
    onSuccess: atualizar,
    onError: mostrarErro,
  });

  const nomeDoCurso = new Map(cursos.data?.map((c) => [c.id, c.nome]));

  function enviarCurso(e: FormEvent) {
    e.preventDefault();
    if (nomeCurso.trim()) criarCurso.mutate(nomeCurso.trim());
  }
  function enviarDisciplina(e: FormEvent) {
    e.preventDefault();
    if (nomeDisciplina.trim()) {
      criarDisciplina.mutate({
        nome: nomeDisciplina.trim(),
        cursoId: cursoDaDisciplina || null,
      });
    }
  }

  const botaoRemover = (
    tipo: 'cursos' | 'disciplinas',
    item: { id: string; nome: string },
  ) => (
    <button
      className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
      disabled={remover.isPending}
      onClick={() =>
        confirm(`Remover "${item.nome}"?`) && remover.mutate({ tipo, id: item.id })
      }
    >
      Remover
    </button>
  );

  return (
    <>
      <Titulo descricao="O que você cadastrar aqui aparece para os alunos no perfil e nos filtros. Só dá para remover o que ninguém está usando.">
        Cursos e disciplinas
      </Titulo>
      {erro ? (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-semibold">Cursos</h2>
          <form onSubmit={enviarCurso} className="mb-4 flex gap-2">
            <input
              aria-label="Nome do curso"
              placeholder="Ex.: Ciência da Computação"
              className={`${campo} flex-1`}
              value={nomeCurso}
              onChange={(e) => setNomeCurso(e.target.value)}
            />
            <Botao type="submit" carregando={criarCurso.isPending}>
              Adicionar
            </Botao>
          </form>
          <Estado
            carregando={cursos.isPending}
            erro={cursos.error}
            vazio={cursos.data?.length === 0}
            textoVazio="Nenhum curso ainda."
          />
          <ul className="divide-y divide-slate-100">
            {cursos.data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                {c.nome}
                {botaoRemover('cursos', c)}
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold">Disciplinas</h2>
          <form onSubmit={enviarDisciplina} className="mb-4 flex flex-wrap gap-2">
            <input
              aria-label="Nome da disciplina"
              placeholder="Ex.: Banco de Dados"
              className={`${campo} min-w-48 flex-1`}
              value={nomeDisciplina}
              onChange={(e) => setNomeDisciplina(e.target.value)}
            />
            <select
              aria-label="Curso da disciplina"
              className={campo}
              value={cursoDaDisciplina}
              onChange={(e) => setCursoDaDisciplina(e.target.value)}
            >
              <option value="">Comum a todos os cursos</option>
              {cursos.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <Botao type="submit" carregando={criarDisciplina.isPending}>
              Adicionar
            </Botao>
          </form>
          <Estado
            carregando={disciplinas.isPending}
            erro={disciplinas.error}
            vazio={disciplinas.data?.length === 0}
            textoVazio="Nenhuma disciplina ainda."
          />
          <ul className="divide-y divide-slate-100">
            {disciplinas.data?.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {d.nome}
                  <span className="block text-xs text-slate-500">
                    {d.cursoId ? nomeDoCurso.get(d.cursoId) : 'Comum a todos os cursos'}
                  </span>
                </span>
                {botaoRemover('disciplinas', d)}
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </>
  );
}
