'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { usePlataforma } from '@/lib/plataforma';

export default function EntrarPlataforma() {
  const { estado, entrar } = usePlataforma();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (estado.tipo === 'logado') router.replace('/plataforma');
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

  const campo =
    'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900';
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl"
        style={{ ['--cor' as string]: '#0f172a' }}
      >
        <div>
          <p className="text-3xl font-extrabold">Pátio</p>
          <h1 className="mt-1 text-lg font-semibold">Plataforma</h1>
          <p className="text-sm text-slate-600">
            Área da equipe do Pátio: faculdades parceiras e métricas gerais.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Senha</span>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
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
