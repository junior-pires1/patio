'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { useSessao } from '@/lib/sessao';

export default function Entrar() {
  const { estado, entrar } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (estado.tipo === 'logado') router.replace('/');
  }, [estado, router]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <p className="text-3xl font-extrabold text-[var(--cor)]">Pátio</p>
          <h1 className="mt-1 text-lg font-semibold">Painel da coordenação</h1>
          <p className="text-sm text-slate-600">
            Entre com a conta da coordenação da sua faculdade.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)] focus:ring-2 focus:ring-[var(--cor)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)] focus:ring-2 focus:ring-[var(--cor)]/20"
          />
        </label>
        {erro ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        ) : null}
        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>
      </form>
    </main>
  );
}
