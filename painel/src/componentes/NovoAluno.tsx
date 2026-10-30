'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Botao, Cartao } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { useSessao } from '@/lib/sessao';

type Curso = { id: string; nome: string };
type Criado = { aluno: { nome: string; email: string }; senhaProvisoria: string };

const VAZIO = { nome: '', apelido: '', email: '', dataNascimento: '', cursoId: '' };
const campo =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)]';

/** Cria a conta de um aluno com senha provisória (para quem não recebe o código por e-mail). */
export function NovoAluno() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [criado, setCriado] = useState<Criado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cursos = useQuery({
    queryKey: ['cursos'],
    queryFn: () => api.get<Curso[]>('/cursos'),
    enabled: aberto,
  });

  const mudar = (chave: keyof typeof VAZIO) => (valor: string) =>
    setForm((f) => ({ ...f, [chave]: valor }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setCampos({});
    setEnviando(true);
    try {
      const r = await api.post<Criado>('/coordenacao/alunos', {
        ...form,
        cursoId: form.cursoId || null,
      });
      setCriado(r);
      setForm(VAZIO);
      void queryClient.invalidateQueries({ queryKey: ['alunos'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo'] });
    } catch (falha) {
      setCampos(
        falha instanceof ErroApi
          ? { ...falha.campos, _: falha.message }
          : { _: 'Não foi possível cadastrar.' },
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="mb-4">
        <Botao onClick={() => setAberto(true)}>Cadastrar aluno</Botao>
      </div>
    );
  }

  const texto = (
    chave: 'nome' | 'apelido' | 'email' | 'dataNascimento',
    rotulo: string,
    tipo = 'text',
  ) => (
    <label className="block text-sm">
      {rotulo}
      <input
        type={tipo}
        className={campo}
        value={form[chave]}
        onChange={(e) => mudar(chave)(e.target.value)}
        required
      />
      {campos[chave] ? <span className="text-red-600">{campos[chave]}</span> : null}
    </label>
  );

  return (
    <Cartao className="mb-4 max-w-2xl">
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Cadastrar aluno</h2>
          <button
            type="button"
            className="text-sm text-slate-500 hover:underline"
            onClick={() => {
              setAberto(false);
              setCriado(null);
            }}
          >
            Fechar
          </button>
        </div>
        <p className="text-sm text-slate-600">
          A conta já nasce verificada. Entregue a senha provisória ao aluno; ele pode
          trocá-la em Perfil → Trocar senha.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {texto('nome', 'Nome completo')}
          {texto('apelido', 'Como quer ser chamado')}
          {texto('email', 'E-mail institucional', 'email')}
          {texto('dataNascimento', 'Data de nascimento', 'date')}
          <label className="block text-sm sm:col-span-2">
            Curso (opcional)
            <select
              className={campo}
              value={form.cursoId}
              onChange={(e) => mudar('cursoId')(e.target.value)}
            >
              <option value="">Sem curso</option>
              {cursos.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        {campos._ ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{campos._}</p>
        ) : null}
        {criado ? (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            Conta criada para <strong>{criado.aluno.email}</strong>. Senha provisória:{' '}
            <code className="rounded bg-white px-1 font-mono text-base">
              {criado.senhaProvisoria}
            </code>
            <br />A senha aparece só agora. Anote antes de cadastrar o próximo.
          </p>
        ) : null}
        <Botao type="submit" carregando={enviando}>
          Cadastrar
        </Botao>
      </form>
    </Cartao>
  );
}
